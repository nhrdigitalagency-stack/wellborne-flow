import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  Mission,
  MissionAssignment,
  TaskPriority,
  UserPrivate,
  UserPublic,
} from '../../types';
import { sanitizeText } from '../../utils/taskUtils';
import { recordAuditLog } from '../audit/auditService';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { createNotification } from '../notifications/notificationService';

export interface CreateMissionInput {
  title: string;
  description: string;
  objectives: string;
  instructions: string;
  startAt: string;
  dueAt: string;
  priority: TaskPriority;
  category: string;
  checklistTemplate: string[];
  assignees: UserPublic[];
}

/**
 * Crée une mission principale + une affectation individuelle indépendante par employé sélectionné
 * + une notification dédiée pour chaque destinataire.
 */
export async function createAndPublishMission(
  manager: UserPrivate,
  input: CreateMissionInput
): Promise<string> {
  if (input.assignees.length === 0) {
    throw new Error('Veuillez sélectionner au moins un collaborateur pour cette mission.');
  }

  const missionRef = doc(collection(db, 'missions'));
  const missionId = missionRef.id;
  const managerName = `${manager.firstName} ${manager.lastName}`.trim();
  const cleanSteps = input.checklistTemplate
    .map((s) => sanitizeText(s, 200))
    .filter((s) => s.length > 0)
    .slice(0, 30);

  const uniqueAssignees = Array.from(new Map(input.assignees.map((u) => [u.uid, u])).values()).slice(0, 50);
  const assignedIds = uniqueAssignees.map((u) => u.uid);

  const now = serverTimestamp();

  try {
    // 1. Créer d'abord le document parent mission
    await setDoc(missionRef, {
      title: sanitizeText(input.title, 200),
      description: sanitizeText(input.description, 4000),
      objectives: sanitizeText(input.objectives, 2000),
      instructions: sanitizeText(input.instructions, 4000),
      createdBy: manager.uid,
      creatorName: sanitizeText(managerName, 160),
      startAt: input.startAt,
      dueAt: input.dueAt,
      priority: input.priority,
      status: 'published',
      category: sanitizeText(input.category || 'Opérations', 80),
      checklistTemplate: cleanSteps,
      assignedEmployeeIds: assignedIds,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Créer les affectations individuelles (ID déterministe = missionId_employeeId) + notifications
    const batch = writeBatch(db);
    for (const emp of uniqueAssignees) {
      const assignmentId = `${missionId}_${emp.uid}`.slice(0, 128);
      const empName = `${emp.firstName} ${emp.lastName}`.trim();
      batch.set(doc(db, 'missionAssignments', assignmentId), {
        missionId,
        missionTitle: sanitizeText(input.title, 200),
        employeeId: emp.uid,
        employeeName: sanitizeText(empName, 160),
        assignedBy: manager.uid,
        assignedByName: sanitizeText(managerName, 160),
        acceptanceStatus: 'pending',
        workStatus: 'not_started',
        taskId: null,
        progress: 0,
        priority: input.priority,
        startAt: input.startAt,
        dueAt: input.dueAt,
        acceptedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        submittedAt: null,
        submissionNote: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: emp.uid,
        type: 'mission_assigned',
        title: `Nouvelle mission attribuée : ${sanitizeText(input.title, 150)}`,
        message: `${managerName} vous a confié une mission à échéance du ${input.dueAt}. Veuillez l’accepter ou indiquer un motif de refus.`,
        entityType: 'assignment',
        entityId: assignmentId,
        readAt: null,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await recordAuditLog({
      actorUid: manager.uid,
      actorName: managerName,
      action: 'mission_created_and_assigned',
      entityType: 'mission',
      entityId: missionId,
      metadata: {
        title: sanitizeText(input.title, 200),
        assigneeCount: uniqueAssignees.length,
      },
    });

    return missionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `missions/${missionId}`);
  }
}

/**
 * Acceptation idempotente via Firestore Transaction :
 * Crée une tâche indépendante (ID déterministe `mission_${missionId}_${uid}`) liée à l'affectation
 * et passe l'affectation à accepted/in_progress atomiquement (impossible de créer des doublons).
 */
export async function acceptMissionAssignment(
  employee: UserPrivate,
  assignment: MissionAssignment
): Promise<string> {
  const assignmentRef = doc(db, 'missionAssignments', assignment.id);
  const missionRef = doc(db, 'missions', assignment.missionId);
  const deterministicTaskId = `m_${assignment.missionId.slice(0, 48)}_${employee.uid.slice(0, 48)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const taskRef = doc(db, 'tasks', deterministicTaskId);
  const empName = `${employee.firstName} ${employee.lastName}`.trim();

  let checklistSteps: string[] = [];

  try {
    await runTransaction(db, async (tx) => {
      const assignSnap = await tx.get(assignmentRef);
      if (!assignSnap.exists()) throw new Error('Affectation introuvable.');
      const currentAssign = assignSnap.data() as Omit<MissionAssignment, 'id'>;

      // Idempotence stricte : si déjà acceptée avec tâche créée, ne rien dupliquer
      if (currentAssign.acceptanceStatus === 'accepted' && currentAssign.taskId) {
        return;
      }
      if (currentAssign.acceptanceStatus !== 'pending') {
        throw new Error('Cette affectation a déjà reçu une réponse.');
      }

      const missionSnap = await tx.get(missionRef);
      if (!missionSnap.exists()) throw new Error('Mission parent introuvable.');
      const missionData = missionSnap.data() as Omit<Mission, 'id'>;
      checklistSteps = missionData.checklistTemplate || [];

      const existingTaskSnap = await tx.get(taskRef);
      const now = serverTimestamp();

      if (!existingTaskSnap.exists()) {
        tx.set(taskRef, {
          title: sanitizeText(missionData.title, 200),
          description: sanitizeText(
            [
              missionData.description,
              missionData.objectives ? `\n\nObjectifs :\n${missionData.objectives}` : '',
              missionData.instructions ? `\n\nInstructions :\n${missionData.instructions}` : '',
            ].join(''),
            4000
          ),
          createdBy: missionData.createdBy,
          creatorName: sanitizeText(missionData.creatorName, 160),
          ownerId: employee.uid,
          ownerName: sanitizeText(empName, 160),
          source: 'mission',
          missionId: assignment.missionId,
          assignmentId: assignment.id,
          startAt: missionData.startAt,
          plannedDate: missionData.startAt,
          dueAt: missionData.dueAt,
          priority: missionData.priority,
          category: sanitizeText(missionData.category || 'Opérations', 80),
          status: 'in_progress',
          publicationStatus: 'published',
          progressMode: checklistSteps.length > 0 ? 'auto' : 'manual',
          progress: 0,
          subtaskCount: checklistSteps.length,
          completedSubtaskCount: 0,
          completedAt: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }

      tx.update(assignmentRef, {
        acceptanceStatus: 'accepted',
        workStatus: 'in_progress',
        taskId: deterministicTaskId,
        acceptedAt: now,
        updatedAt: now,
      });
    });

    // Créer la checklist indépendante sur la tâche nouvellement créée
    if (checklistSteps.length > 0) {
      const batch = writeBatch(db);
      checklistSteps.forEach((stepTitle, idx) => {
        const subId = `step_${idx + 1}`;
        batch.set(doc(db, 'tasks', deterministicTaskId, 'subtasks', subId), {
          title: sanitizeText(stepTitle, 200),
          description: null,
          order: idx,
          completed: false,
          completedBy: null,
          completedAt: null,
          ownerId: employee.uid,
          publicationStatus: 'published',
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    await createNotification({
      recipientId: assignment.assignedBy,
      type: 'mission_accepted',
      title: `Mission acceptée : ${assignment.missionTitle}`,
      message: `${empName} a accepté la mission et démarré son exécution individuelle.`,
      entityType: 'mission',
      entityId: assignment.missionId,
    });

    await recordAuditLog({
      actorUid: employee.uid,
      actorName: empName,
      action: 'mission_assignment_accepted',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: { missionId: assignment.missionId, taskId: deterministicTaskId },
    });

    return deterministicTaskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `missionAssignments/${assignment.id}`);
  }
}

export async function rejectMissionAssignment(
  employee: UserPrivate,
  assignment: MissionAssignment,
  reason: string
): Promise<void> {
  const cleanReason = sanitizeText(reason, 1000);
  if (cleanReason.length < 3) {
    throw new Error('Veuillez indiquer un motif de refus (au moins 3 caractères).');
  }

  const empName = `${employee.firstName} ${employee.lastName}`.trim();
  const path = `missionAssignments/${assignment.id}`;
  try {
    await updateDoc(doc(db, 'missionAssignments', assignment.id), {
      acceptanceStatus: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectionReason: cleanReason,
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      recipientId: assignment.assignedBy,
      type: 'mission_rejected',
      title: `Mission refusée : ${assignment.missionTitle}`,
      message: `${empName} a refusé la mission. Motif : ${cleanReason}`,
      entityType: 'mission',
      entityId: assignment.missionId,
    });

    await recordAuditLog({
      actorUid: employee.uid,
      actorName: empName,
      action: 'mission_assignment_rejected',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: { missionId: assignment.missionId, reason: cleanReason },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitMissionWork(
  employee: UserPrivate,
  assignmentId: string,
  taskId: string,
  progress: number,
  submissionNote: string
): Promise<void> {
  const empName = `${employee.firstName} ${employee.lastName}`.trim();
  const assignSnap = await getDoc(doc(db, 'missionAssignments', assignmentId));
  if (!assignSnap.exists()) throw new Error('Affectation introuvable.');
  const assign = assignSnap.data() as Omit<MissionAssignment, 'id'>;

  const cleanNote = sanitizeText(submissionNote || 'Travail soumis pour validation.', 2000);
  const now = serverTimestamp();

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'missionAssignments', assignmentId), {
      workStatus: 'submitted',
      progress: Math.min(99, Math.max(progress, 0)),
      submittedAt: now,
      submissionNote: cleanNote,
      updatedAt: now,
    });
    batch.update(doc(db, 'tasks', taskId), {
      status: 'submitted',
      progress: Math.min(99, Math.max(progress, 0)),
      updatedAt: now,
    });
    await batch.commit();

    await createNotification({
      recipientId: assign.assignedBy,
      type: 'work_submitted',
      title: `Travail soumis pour validation : ${assign.missionTitle}`,
      message: `${empName} a soumis son travail pour examen. Note : ${cleanNote.slice(0, 140)}`,
      entityType: 'assignment',
      entityId: assignmentId,
    });

    await recordAuditLog({
      actorUid: employee.uid,
      actorName: empName,
      action: 'mission_work_submitted',
      entityType: 'assignment',
      entityId: assignmentId,
      metadata: { taskId, missionId: assign.missionId },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `missionAssignments/${assignmentId}`);
  }
}

export async function reviewMissionSubmission(
  manager: UserPrivate,
  assignment: MissionAssignment,
  decision: 'approved' | 'changes_requested',
  reviewComment: string
): Promise<void> {
  const cleanComment = sanitizeText(reviewComment, 2000);
  if (decision === 'changes_requested' && cleanComment.length < 3) {
    throw new Error('Veuillez préciser les corrections attendues.');
  }

  const managerName = `${manager.firstName} ${manager.lastName}`.trim();
  const now = serverTimestamp();

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'missionAssignments', assignment.id), {
      workStatus: decision,
      progress: decision === 'approved' ? 100 : assignment.progress,
      reviewedAt: now,
      reviewComment: cleanComment || (decision === 'approved' ? 'Travail validé.' : ''),
      updatedAt: now,
    });

    if (assignment.taskId) {
      batch.update(doc(db, 'tasks', assignment.taskId), {
        status: decision === 'approved' ? 'completed' : 'changes_requested',
        progress: decision === 'approved' ? 100 : Math.min(95, assignment.progress),
        completedAt: decision === 'approved' ? now : null,
        updatedAt: now,
      });
    }

    await batch.commit();

    await createNotification({
      recipientId: assignment.employeeId,
      type: decision === 'approved' ? 'work_approved' : 'changes_requested',
      title:
        decision === 'approved'
          ? `Travail approuvé : ${assignment.missionTitle}`
          : `Corrections demandées : ${assignment.missionTitle}`,
      message:
        decision === 'approved'
          ? `${managerName} a validé votre mission. ${cleanComment}`
          : `${managerName} demande des ajustements : ${cleanComment}`,
      entityType: assignment.taskId ? 'task' : 'assignment',
      entityId: assignment.taskId || assignment.id,
    });

    await recordAuditLog({
      actorUid: manager.uid,
      actorName: managerName,
      action: decision === 'approved' ? 'mission_work_approved' : 'mission_changes_requested',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: {
        employeeId: assignment.employeeId,
        missionId: assignment.missionId,
        comment: cleanComment,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `missionAssignments/${assignment.id}`);
  }
}

export function subscribeMyAssignments(
  employeeUid: string,
  onData: (items: MissionAssignment[]) => void
): () => void {
  const path = 'missionAssignments';
  const q = query(collection(db, path), where('employeeId', '==', employeeUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MissionAssignment, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeManagedAssignments(
  managerUid: string,
  isBootstrapAdmin: boolean,
  onData: (items: MissionAssignment[]) => void
): () => void {
  const path = 'missionAssignments';
  const q = isBootstrapAdmin
    ? query(collection(db, path))
    : query(collection(db, path), where('assignedBy', '==', managerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MissionAssignment, 'id'>) }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeManagedMissions(
  managerUid: string,
  isBootstrapAdmin: boolean,
  onData: (items: Mission[]) => void
): () => void {
  const path = 'missions';
  const q = isBootstrapAdmin
    ? query(collection(db, path))
    : query(collection(db, path), where('createdBy', '==', managerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Mission, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeEmployeeMissions(
  employeeUid: string,
  onData: (items: Mission[]) => void
): () => void {
  const path = 'missions';
  const q = query(collection(db, path), where('assignedEmployeeIds', 'array-contains', employeeUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Mission, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function getMissionById(missionId: string): Promise<Mission | null> {
  const path = `missions/${missionId}`;
  try {
    const snap = await getDoc(doc(db, 'missions', missionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Mission, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
