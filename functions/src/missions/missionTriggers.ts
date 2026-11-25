import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { DATABASE_ID, db } from '../index';

async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  route: string
): Promise<void> {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return;
  const userData = userSnap.data()!;
  if (userData.notificationPreferences?.webPush === false) return;

  const tokensSnap = await db
    .collection('deviceTokens')
    .where('userId', '==', userId)
    .where('enabled', '==', true)
    .get();
  const tokens = tokensSnap.docs
    .map((d) => ({ ref: d.ref, token: String(d.data().token || '') }))
    .filter((item) => item.token.length > 10);

  if (tokens.length === 0) return;

  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: { route },
  });

  const cleanups: Array<Promise<unknown>> = [];
  response.responses.forEach((res, idx) => {
    if (
      !res.success &&
      (res.error?.code === 'messaging/registration-token-not-registered' ||
        res.error?.code === 'messaging/invalid-registration-token')
    ) {
      cleanups.push(tokens[idx].ref.delete());
    }
  });
  await Promise.all(cleanups);
}

/**
 * Envoie une notification Push FCM lorsqu'une affectation de mission est créée.
 */
export const onMissionAssignmentCreated = onDocumentCreated(
  {
    document: 'missionAssignments/{assignmentId}',
    database: DATABASE_ID,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const employeeId = String(data.employeeId || '');
    const missionTitle = String(data.missionTitle || 'Nouvelle mission');
    const assignedByName = String(data.assignedByName || 'Responsable');

    if (!employeeId) return;

    await sendPushToUser(
      employeeId,
      'WELLBORNE FLOW — Nouvelle mission attribuée',
      `${assignedByName} vous a attribué : ${missionTitle}`,
      '/missions'
    );
    logger.info('Push mission attribuée envoyé', {
      assignmentId: event.params.assignmentId,
      employeeId,
    });
  }
);

/**
 * Envoie une notification Push FCM lors des transitions majeures d'une affectation de mission :
 * - acceptation / refus -> vers le responsable (`assignedBy`)
 * - soumission -> vers le responsable (`assignedBy`)
 * - validation / corrections demandées -> vers l'employé (`employeeId`)
 */
export const onMissionAssignmentUpdated = onDocumentUpdated(
  {
    document: 'missionAssignments/{assignmentId}',
    database: DATABASE_ID,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const missionTitle = String(after.missionTitle || 'Mission');
    const employeeName = String(after.employeeName || 'Collaborateur');
    const managerId = String(after.assignedBy || '');
    const employeeId = String(after.employeeId || '');

    if (before.acceptanceStatus !== after.acceptanceStatus && managerId) {
      if (after.acceptanceStatus === 'accepted') {
        await sendPushToUser(
          managerId,
          'Mission acceptée',
          `${employeeName} a accepté la mission « ${missionTitle} ».`,
          '/responsable/missions'
        );
      } else if (after.acceptanceStatus === 'rejected') {
        await sendPushToUser(
          managerId,
          'Mission refusée',
          `${employeeName} a refusé « ${missionTitle} » : ${String(after.rejectionReason || '')}`,
          '/responsable/missions'
        );
      }
    }

    if (before.workStatus !== after.workStatus) {
      if (after.workStatus === 'submitted' && managerId) {
        await sendPushToUser(
          managerId,
          'Mission soumise pour validation',
          `${employeeName} a soumis « ${missionTitle} ».`,
          '/responsable/validations'
        );
      } else if (after.workStatus === 'approved' && employeeId) {
        await sendPushToUser(
          employeeId,
          'Mission validée',
          `Votre mission « ${missionTitle} » a été validée.`,
          '/missions'
        );
      } else if (after.workStatus === 'changes_requested' && employeeId) {
        await sendPushToUser(
          employeeId,
          'Corrections demandées sur une mission',
          `Des corrections sont demandées sur « ${missionTitle} ».`,
          '/missions'
        );
      }
    }
  }
);
