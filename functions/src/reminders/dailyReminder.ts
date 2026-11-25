import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../index';

const DEFAULT_TIMEZONE = 'Africa/Douala';

function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Rappel quotidien automatique à 20h00 (heure locale Africa/Douala).
 * - Identifie les tâches publiées, non supprimées et non terminées/annulées
 *   dont la date d'échéance (`dueAt` YYYY-MM-DD) est aujourd'hui ou dépassée.
 * - Garantit l'idempotence via `reminderDeliveries/{userId}_{taskId}_{localDate}`.
 * - Crée des notifications in-app conformes au schéma `notifications` et envoie
 *   des notifications Push FCM via `deviceTokens`.
 */
export const sendDailyEveningReminders = onSchedule(
  {
    schedule: '0 20 * * *',
    timeZone: DEFAULT_TIMEZONE,
    retryCount: 2,
  },
  async () => {
    const settingsSnap = await db.collection('organizationSettings').doc('global').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : null;

    const timeZone =
      typeof settings?.timezone === 'string' && settings.timezone.length > 0
        ? settings.timezone
        : DEFAULT_TIMEZONE;
    const todayKey = getLocalDateKey(new Date(), timeZone);

    // 1. Tâches publiées (filtrage deletedAt / statut en mémoire pour compatibilité sans index additionnel)
    const tasksSnap = await db
      .collection('tasks')
      .where('publicationStatus', '==', 'published')
      .get();

    const pendingTasksByUser = new Map<
      string,
      Array<{ id: string; title: string; dueDay: string; isOverdue: boolean }>
    >();

    for (const docSnap of tasksSnap.docs) {
      const data = docSnap.data();
      if (data.deletedAt != null) continue;
      if (data.status === 'completed' || data.status === 'cancelled') continue;

      const dueDay = typeof data.dueAt === 'string' ? data.dueAt.slice(0, 10) : '';
      if (!dueDay || dueDay > todayKey) continue;

      const ownerId = String(data.ownerId || '');
      if (!ownerId) continue;

      const list = pendingTasksByUser.get(ownerId) ?? [];
      list.push({
        id: docSnap.id,
        title: String(data.title || 'Tâche sans titre'),
        dueDay,
        isOverdue: dueDay < todayKey,
      });
      pendingTasksByUser.set(ownerId, list);
    }

    let remindersCreated = 0;
    let pushSentCount = 0;
    const messaging = getMessaging();

    for (const [userId, userTasks] of pendingTasksByUser.entries()) {
      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) continue;
      const userData = userSnap.data()!;
      if (userData.accountStatus !== 'active') continue;
      if (userData.notificationPreferences?.dailyReminder === false) continue;

      const notifiedTasks: typeof userTasks = [];

      for (const task of userTasks) {
        const deliveryId = `${userId}_${task.id}_${todayKey}`;
        const deliveryRef = db.collection('reminderDeliveries').doc(deliveryId);
        const existingDelivery = await deliveryRef.get();
        if (existingDelivery.exists) {
          continue; // Idempotence stricte
        }

        const notifRef = db.collection('notifications').doc();
        const title = task.isOverdue
          ? `Rappel 20h — Tâche en retard : ${task.title}`
          : `Rappel 20h — Échéance du jour : ${task.title}`;
        const message = task.isOverdue
          ? `La tâche « ${task.title} » (échéance ${task.dueDay}) n’est pas encore terminée.`
          : `La tâche « ${task.title} » prévue pour aujourd’hui (${todayKey}) reste à finaliser.`;

        const batch = db.batch();
        batch.set(deliveryRef, {
          userId,
          taskId: task.id,
          localDate: todayKey,
          reminderType: 'daily_20h',
          sentAt: FieldValue.serverTimestamp(),
        });
        batch.set(notifRef, {
          recipientId: userId,
          type: 'daily_reminder',
          title: title.slice(0, 200),
          message: message.slice(0, 2000),
          entityType: 'task',
          entityId: task.id,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();

        remindersCreated += 1;
        notifiedTasks.push(task);
      }

      // Envoi Push Web FCM si activé et si des tokens actifs existent
      if (
        notifiedTasks.length > 0 &&
        userData.notificationPreferences?.webPush !== false
      ) {
        const tokensSnap = await db
          .collection('deviceTokens')
          .where('userId', '==', userId)
          .where('enabled', '==', true)
          .get();

        const tokens = tokensSnap.docs
          .map((d) => ({ ref: d.ref, token: String(d.data().token || '') }))
          .filter((item) => item.token.length > 10);

        if (tokens.length > 0) {
          const response = await messaging.sendEachForMulticast({
            tokens: tokens.map((t) => t.token),
            notification: {
              title: 'WELLBORNE FLOW — Rappel du soir (20h00)',
              body:
                notifiedTasks.length === 1
                  ? `1 tâche reste à finaliser : ${notifiedTasks[0].title}`
                  : `${notifiedTasks.length} tâches restent à finaliser aujourd’hui ou sont en retard.`,
            },
            data: {
              route: '/taches',
              localDate: todayKey,
            },
          });

          pushSentCount += response.successCount;

          const cleanupDeletes: Array<Promise<unknown>> = [];
          response.responses.forEach((res, idx) => {
            if (
              !res.success &&
              (res.error?.code === 'messaging/registration-token-not-registered' ||
                res.error?.code === 'messaging/invalid-registration-token')
            ) {
              cleanupDeletes.push(tokens[idx].ref.delete());
            }
          });
          await Promise.all(cleanupDeletes);
        }
      }
    }

    await db.collection('auditLogs').add({
      actorUid: 'system_scheduler',
      actorName: 'Planificateur Cloud (20h00)',
      action: 'daily_reminder_scheduled_run',
      entityType: 'reminder',
      entityId: `daily_${todayKey}`,
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        localDate: todayKey,
        timezone: timeZone,
        remindersCreated,
        pushSentCount,
      },
    });

    logger.info('Rappels quotidiens 20h00 exécutés', {
      todayKey,
      remindersCreated,
      pushSentCount,
    });
  }
);
