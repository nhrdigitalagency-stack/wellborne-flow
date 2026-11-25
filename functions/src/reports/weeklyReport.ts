import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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

function timestampToLocalISO(ts: Timestamp | null | undefined, timeZone: string): string | null {
  if (!ts || typeof ts.toDate !== 'function') return null;
  return getLocalDateKey(ts.toDate(), timeZone);
}

function getPreviousWeekRange(now: Date, timeZone: string): {
  periodStart: string;
  periodEnd: string;
  todayISO: string;
} {
  const todayISO = getLocalDateKey(now, timeZone);
  const [y, m, d] = todayISO.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay(); // 0=dim, 1=lun...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const prevMonday = new Date(utcDate);
  prevMonday.setUTCDate(utcDate.getUTCDate() - daysSinceMonday - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);

  return {
    periodStart: prevMonday.toISOString().slice(0, 10),
    periodEnd: prevSunday.toISOString().slice(0, 10),
    todayISO,
  };
}

interface TaskDoc {
  ownerId: string;
  status: string;
  progress: number;
  plannedDate?: string;
  dueAt?: string;
  deletedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface AssignmentDoc {
  employeeId: string;
  acceptanceStatus: string;
  workStatus: string;
  dueAt?: string;
  createdAt?: Timestamp;
}

/**
 * Calcule les métriques officielles de WELLBORNE FLOW (identique à src/utils/taskUtils.ts).
 */
function computeReportMetrics(
  tasks: TaskDoc[],
  assignments: AssignmentDoc[],
  periodStart: string,
  periodEnd: string,
  todayISO: string,
  timeZone: string
) {
  const nonDeletedTasks = tasks.filter((t) => !t.deletedAt && t.status !== 'cancelled');

  const tasksCreated = nonDeletedTasks.filter((t) => {
    const createdDay = timestampToLocalISO(t.createdAt, timeZone);
    return createdDay !== null && createdDay >= periodStart && createdDay <= periodEnd;
  }).length;

  const tasksPlanned = nonDeletedTasks.filter((t) => {
    const p = t.plannedDate?.slice(0, 10);
    return Boolean(p && p >= periodStart && p <= periodEnd);
  }).length;

  const expectedTasks = nonDeletedTasks.filter((t) => {
    const d = t.dueAt?.slice(0, 10);
    return Boolean(d && d >= periodStart && d <= periodEnd);
  });

  const completedInPeriod = nonDeletedTasks.filter((t) => {
    if (t.status !== 'completed') return false;
    const completedDay =
      timestampToLocalISO(t.completedAt, timeZone) ??
      timestampToLocalISO(t.updatedAt, timeZone);
    return completedDay !== null && completedDay >= periodStart && completedDay <= periodEnd;
  });

  const expectedAndCompleted = expectedTasks.filter((t) => t.status === 'completed');

  const tasksCompletedOnTime = completedInPeriod.filter((t) => {
    const completedDay =
      timestampToLocalISO(t.completedAt, timeZone) ??
      timestampToLocalISO(t.updatedAt, timeZone);
    const dueDay = t.dueAt?.slice(0, 10);
    return Boolean(completedDay && dueDay && completedDay <= dueDay);
  }).length;

  const tasksCompletedLate = completedInPeriod.length - tasksCompletedOnTime;

  const activeTasks = nonDeletedTasks.filter((t) => t.status !== 'completed');
  const overdueTasks = activeTasks.filter((t) => {
    const dueDay = t.dueAt?.slice(0, 10);
    return Boolean(dueDay && dueDay < todayISO);
  });

  const deferredTasks = nonDeletedTasks.filter((t) => {
    const p = t.plannedDate?.slice(0, 10);
    const d = t.dueAt?.slice(0, 10);
    return Boolean(p && d && p > d && t.status !== 'completed');
  }).length;

  const periodAssignments = assignments.filter((a) => {
    const createdDay = timestampToLocalISO(a.createdAt, timeZone);
    const dueDay = a.dueAt?.slice(0, 10);
    return (
      (createdDay !== null && createdDay >= periodStart && createdDay <= periodEnd) ||
      Boolean(dueDay && dueDay >= periodStart && dueDay <= periodEnd)
    );
  });

  const averageActiveProgress =
    activeTasks.length > 0
      ? Math.round(
          activeTasks.reduce((sum, t) => sum + Number(t.progress || 0), 0) / activeTasks.length
        )
      : 0;

  const completionRate =
    expectedTasks.length > 0
      ? Math.round((expectedAndCompleted.length / expectedTasks.length) * 100)
      : completedInPeriod.length > 0
      ? 100
      : 0;

  return {
    totals: {
      tasksCreated,
      tasksPlanned,
      tasksExpectedInPeriod: expectedTasks.length,
      tasksCompletedInPeriod: completedInPeriod.length,
      tasksCompletedOnTime,
      tasksCompletedLate,
      tasksActive: activeTasks.length,
      tasksOverdue: overdueTasks.length,
      tasksDeferred: deferredTasks,
      missionsReceived: periodAssignments.length,
      missionsAccepted: periodAssignments.filter((a) => a.acceptanceStatus === 'accepted').length,
      missionsRejected: periodAssignments.filter((a) => a.acceptanceStatus === 'rejected').length,
      submissionsCount: periodAssignments.filter(
        (a) =>
          a.workStatus === 'submitted' ||
          a.workStatus === 'approved' ||
          a.workStatus === 'changes_requested'
      ).length,
      approvedCount: periodAssignments.filter((a) => a.workStatus === 'approved').length,
      averageActiveProgress,
    },
    completionRate,
  };
}

/**
 * Génération automatique des rapports hebdomadaires chaque lundi à 06h00 (Africa/Douala).
 * - Couvre la semaine précédente complète (lundi → dimanche).
 * - Strictement idempotent via des identifiants déterministes.
 * - Aligné sur le schéma `reports` de `firestore.rules`.
 */
export const generateWeeklyReports = onSchedule(
  {
    schedule: '0 6 * * 1',
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

    const { periodStart, periodEnd, todayISO } = getPreviousWeekRange(new Date(), timeZone);

    const [usersSnap, tasksSnap, assignmentsSnap] = await Promise.all([
      db.collection('users').where('accountStatus', '==', 'active').get(),
      db.collection('tasks').where('publicationStatus', '==', 'published').get(),
      db.collection('missionAssignments').get(),
    ]);

    const allTasks: TaskDoc[] = tasksSnap.docs.map((d) => d.data() as TaskDoc);
    const allAssignments: AssignmentDoc[] = assignmentsSnap.docs.map(
      (d) => d.data() as AssignmentDoc
    );

    let generatedIndividual = 0;

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      const uid = userDoc.id;
      const reportId = `weekly_ind_${uid}_${periodStart.replace(/-/g, '')}`;
      const reportRef = db.collection('reports').doc(reportId);
      const existing = await reportRef.get();
      if (existing.exists) continue;

      const userTasks = allTasks.filter((t) => t.ownerId === uid);
      const userAssignments = allAssignments.filter((a) => a.employeeId === uid);
      const { totals, completionRate } = computeReportMetrics(
        userTasks,
        userAssignments,
        periodStart,
        periodEnd,
        todayISO,
        timeZone
      );

      await reportRef.set({
        type: 'individual',
        periodKind: 'weekly',
        employeeId: uid,
        employeeName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || uid,
        periodStart,
        periodEnd,
        totals,
        completionRate,
        generatedBy: 'system_scheduler',
        generatedAt: FieldValue.serverTimestamp(),
      });
      generatedIndividual += 1;
    }

    const collectiveId = `weekly_col_${periodStart.replace(/-/g, '')}`;
    const collectiveRef = db.collection('reports').doc(collectiveId);
    const existingCollective = await collectiveRef.get();
    let collectiveCreated = false;

    if (!existingCollective.exists) {
      const { totals, completionRate } = computeReportMetrics(
        allTasks,
        allAssignments,
        periodStart,
        periodEnd,
        todayISO,
        timeZone
      );

      await collectiveRef.set({
        type: 'collective',
        periodKind: 'weekly',
        employeeId: null,
        employeeName: 'Entreprise — Vue globale',
        periodStart,
        periodEnd,
        totals,
        completionRate,
        generatedBy: 'system_scheduler',
        generatedAt: FieldValue.serverTimestamp(),
      });
      collectiveCreated = true;

      // Notification aux responsables et administrateurs
      const leaders = usersSnap.docs.filter(
        (d) => d.data().role === 'manager' || d.data().role === 'admin'
      );
      await Promise.all(
        leaders.map((leader) =>
          db.collection('notifications').add({
            recipientId: leader.id,
            type: 'daily_reminder',
            title: `Rapport hebdomadaire prêt (${periodStart} → ${periodEnd})`,
            message: `Taux de réalisation collectif : ${completionRate} % (${totals.tasksCompletedInPeriod} tâche(s) terminée(s)).`,
            entityType: 'report',
            entityId: collectiveId,
            readAt: null,
            createdAt: FieldValue.serverTimestamp(),
          })
        )
      );
    }

    await db.collection('auditLogs').add({
      actorUid: 'system_scheduler',
      actorName: 'Planificateur Cloud (Lundi 06h00)',
      action: 'weekly_report_scheduled_run',
      entityType: 'report',
      entityId: collectiveId,
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        periodStart,
        periodEnd,
        generatedIndividual,
        collectiveCreated,
      },
    });

    logger.info('Rapports hebdomadaires traités', {
      periodStart,
      periodEnd,
      generatedIndividual,
      collectiveCreated,
    });
  }
);
