import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { AppNotification, DeviceToken, NotificationType, Task } from '../../types';
import { getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';
import { sanitizeText } from '../../utils/taskUtils';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: AppNotification['entityType'];
  entityId: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const path = 'notifications';
  try {
    const ref = doc(collection(db, path));
    await setDoc(ref, {
      recipientId: input.recipientId,
      type: input.type,
      title: sanitizeText(input.title, 200),
      message: sanitizeText(input.message, 2000),
      entityType: input.entityType,
      entityId: sanitizeText(input.entityId, 128),
      readAt: null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserNotifications(
  userId: string,
  onData: (items: AppNotification[]) => void
): () => void {
  const path = 'notifications';
  // Requête mono-champ (aucun index composite requis) + tri client-side par date décroissante
  const q = query(collection(db, path), where('recipientId', '==', userId));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppNotification, 'id'>),
        }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, 80);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      readAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.readAt);
  if (unread.length === 0) return;

  const path = 'notifications';
  try {
    const batch = writeBatch(db);
    for (const item of unread.slice(0, 400)) {
      batch.update(doc(db, 'notifications', item.id), {
        readAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function getOrCreateInstallationId(userId: string): string {
  const storageKey = 'taskflow_installation_id';
  let deviceId = localStorage.getItem(storageKey);
  if (!deviceId || !/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId)) {
    deviceId = `web_${crypto.randomUUID().replace(/-/g, '')}`;
    localStorage.setItem(storageKey, deviceId);
  }
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return `${safeUid}_${deviceId}`.slice(0, 128);
}

export async function registerBrowserPushPreference(
  userId: string,
  enabled: boolean
): Promise<{ status: 'granted' | 'denied' | 'unsupported' | 'disabled'; installationId: string }> {
  const installationId = getOrCreateInstallationId(userId);
  const path = `deviceTokens/${installationId}`;

  let permission: 'granted' | 'denied' | 'unsupported' | 'disabled' = enabled ? 'granted' : 'disabled';

  if (enabled) {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      permission = 'unsupported';
    } else if (Notification.permission === 'granted') {
      permission = 'granted';
    } else if (Notification.permission === 'denied') {
      permission = 'denied';
    } else {
      const result = await Notification.requestPermission();
      permission = result === 'granted' ? 'granted' : 'denied';
    }
  }

  try {
    const isActuallyEnabled = enabled && permission === 'granted';
    const payload: Omit<DeviceToken, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
      userId,
      installationId,
      platform: navigator.userAgent.includes('Mobile') ? 'web_mobile' : 'web_desktop',
      token: isActuallyEnabled ? `browser_webpush_${installationId}` : null,
      enabled: isActuallyEnabled,
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'deviceTokens', installationId), payload);
    return { status: permission, installationId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getDevicePushStatus(userId: string): Promise<DeviceToken | null> {
  if (!auth.currentUser || auth.currentUser.uid !== userId || !auth.currentUser.emailVerified) {
    return null;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  const installationId = getOrCreateInstallationId(userId);
  const path = `deviceTokens/${installationId}`;
  try {
    const snap = await getDoc(doc(db, 'deviceTokens', installationId));
    if (!snap.exists()) return null;
    const data = snap.data() as DeviceToken;
    return data.userId === userId ? data : null;
  } catch (error) {
    const code = (error as { code?: string })?.code || '';
    const message = error instanceof Error ? error.message : String(error);
    // Ignorer proprement les erreurs transitoires hors ligne ou post-déconnexion
    if (
      !auth.currentUser ||
      code === 'unavailable' ||
      message.toLowerCase().includes('client is offline')
    ) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Exécution idempotente côté administrateur d'un cycle de rappel quotidien (20h00 Africa/Douala)
 * respectant strictement la collection reminderDeliveries (aucun doublon par utilisateur, tâche et date locale).
 */
export async function runManualDailyReminders(
  tasks: Task[],
  usersById: Map<string, { firstName: string; accountStatus: string }>
): Promise<{ sentUsers: number; skippedDuplicates: number; reminderTasksCount: number }> {
  const todayISO = getTodayDoualaISO();
  const activeByUser = new Map<string, Task[]>();

  for (const task of tasks) {
    if (task.deletedAt || task.status === 'completed' || task.status === 'cancelled') continue;
    const owner = usersById.get(task.ownerId);
    if (!owner || owner.accountStatus !== 'active') continue;

    const plannedDay = task.plannedDate?.slice(0, 10) || '';
    const dueDay = task.dueAt?.slice(0, 10) || '';
    const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
    const isDueOrPlannedTodayOrEarlier =
      (plannedDay !== '' && plannedDay <= todayISO) || (dueDay !== '' && dueDay <= todayISO);

    // Exclure les tâches exclusivement prévues pour une date future
    if (!overdue && !isDueOrPlannedTodayOrEarlier && task.status === 'todo') continue;

    const list = activeByUser.get(task.ownerId) || [];
    list.push(task);
    activeByUser.set(task.ownerId, list);
  }

  let sentUsers = 0;
  let skippedDuplicates = 0;
  let reminderTasksCount = 0;

  for (const [uid, userTasks] of activeByUser.entries()) {
    const freshTasks: Task[] = [];
    for (const task of userTasks) {
      const deliveryId = `${uid}_${task.id}_${todayISO}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const deliveryRef = doc(db, 'reminderDeliveries', deliveryId);
      const existing = await getDoc(deliveryRef);
      if (existing.exists()) {
        skippedDuplicates++;
      } else {
        freshTasks.push(task);
      }
    }

    if (freshTasks.length === 0) continue;

    const firstName = usersById.get(uid)?.firstName || 'Collaborateur';
    const lines = freshTasks.slice(0, 6).map((t, idx) => {
      const tag = isTaskOverdue(t.dueAt, t.status, todayISO)
        ? 'en retard'
        : t.dueAt?.slice(0, 10) === todayISO
        ? 'échéance aujourd’hui'
        : t.status === 'blocked'
        ? 'bloquée'
        : 'en cours';
      return `${idx + 1}. ${t.title} — ${tag}`;
    });

    const message =
      `Bonsoir ${firstName} ! Voici le rappel de vos activités non terminées sur WELLBORNE FLOW :\n` +
      `${lines.join('\n')}\n` +
      `Veuillez actualiser votre progression et soumettre vos travaux lorsque ceux-ci sont terminés.`;

    const batch = writeBatch(db);
    for (const task of freshTasks) {
      const deliveryId = `${uid}_${task.id}_${todayISO}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      batch.set(doc(db, 'reminderDeliveries', deliveryId), {
        userId: uid,
        taskId: task.id,
        localDate: todayISO,
        reminderType: 'manual_admin',
        sentAt: serverTimestamp(),
      });
    }
    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      recipientId: uid,
      type: 'daily_reminder',
      title: `Rappel quotidien (${freshTasks.length} activité${freshTasks.length > 1 ? 's' : ''})`,
      message: sanitizeText(message, 2000),
      entityType: 'task',
      entityId: freshTasks[0].id,
      readAt: null,
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      sentUsers++;
      reminderTasksCount += freshTasks.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reminderDeliveries');
    }
  }

  return { sentUsers, skippedDuplicates, reminderTasksCount };
}
