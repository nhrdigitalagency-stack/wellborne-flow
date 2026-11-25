import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  PublicationStatus,
  Subtask,
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  UserPrivate,
} from '../../types';
import { clampManualProgress, computeAutoProgress, sanitizeText } from '../../utils/taskUtils';
import { recordAuditLog } from '../audit/auditService';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { createNotification } from '../notifications/notificationService';

export interface CreateTaskInput {
  title: string;
  description: string;
  startAt: string;
  plannedDate: string;
  dueAt: string;
  priority: TaskPriority;
  category: string;
  labelIds?: string[];
  publicationStatus: PublicationStatus;
  subtasks: { title: string; description?: string }[];
}

function normalizeLabelIds(ids?: string[]): string[] {
  if (!Array.isArray(ids)) return [];
  const unique = new Set<string>();
  for (const id of ids) {
    const clean = id.trim();
    if (clean) unique.add(clean);
    if (unique.size >= 8) break;
  }
  return Array.from(unique);
}

export async function createPersonalTask(
  actor: UserPrivate,
  input: CreateTaskInput
): Promise<string> {
  const taskRef = doc(collection(db, 'tasks'));
  const taskId = taskRef.id;
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();
  const validSubtasks = input.subtasks
    .map((s) => ({ title: sanitizeText(s.title, 200), description: sanitizeText(s.description || '', 1000) }))
    .filter((s) => s.title.length > 0);

  const now = serverTimestamp();

  try {
    // 1. Créer d'abord le document parent (nécessaire pour la règle Master Gate des sous-tâches)
    await setDoc(taskRef, {
      title: sanitizeText(input.title, 200),
      description: sanitizeText(input.description, 4000),
      createdBy: actor.uid,
      creatorName: sanitizeText(fullName, 160),
      ownerId: actor.uid,
      ownerName: sanitizeText(fullName, 160),
      source: 'personal',
      missionId: null,
      assignmentId: null,
      startAt: input.startAt,
      plannedDate: input.plannedDate || input.startAt,
      dueAt: input.dueAt,
      priority: input.priority,
      category: sanitizeText(input.category || 'Opérations', 80),
      labelIds: normalizeLabelIds(input.labelIds),
      status: 'todo',
      publicationStatus: input.publicationStatus,
      progressMode: validSubtasks.length > 0 ? 'auto' : 'manual',
      progress: 0,
      subtaskCount: validSubtasks.length,
      completedSubtaskCount: 0,
      completedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Créer les étapes (sous-tâches) en lot
    if (validSubtasks.length > 0) {
      const batch = writeBatch(db);
      validSubtasks.forEach((step, index) => {
        const subRef = doc(collection(db, 'tasks', taskId, 'subtasks'));
        batch.set(subRef, {
          title: step.title,
          description: step.description || null,
          order: index,
          completed: false,
          completedBy: null,
          completedAt: null,
          ownerId: actor.uid,
          publicationStatus: input.publicationStatus,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: fullName,
      action: input.publicationStatus === 'published' ? 'task_created_published' : 'task_created_draft',
      entityType: 'task',
      entityId: taskId,
      metadata: {
        title: sanitizeText(input.title, 200),
        priority: input.priority,
        subtasks: validSubtasks.length,
      },
    });

    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
  }
}

export async function updatePersonalTaskDetails(
  actor: UserPrivate,
  task: Task,
  updates: {
    title?: string;
    description?: string;
    startAt?: string;
    plannedDate?: string;
    dueAt?: string;
    priority?: TaskPriority;
    category?: string;
    labelIds?: string[];
    publicationStatus?: PublicationStatus;
    status?: TaskStatus;
    progress?: number;
  }
): Promise<void> {
  const path = `tasks/${task.id}`;
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();

  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.title !== undefined) patch.title = sanitizeText(updates.title, 200);
  if (updates.description !== undefined) patch.description = sanitizeText(updates.description, 4000);
  if (updates.startAt !== undefined) patch.startAt = updates.startAt;
  if (updates.plannedDate !== undefined) patch.plannedDate = updates.plannedDate;
  if (updates.dueAt !== undefined) patch.dueAt = updates.dueAt;
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.category !== undefined) patch.category = sanitizeText(updates.category, 80);
  if (updates.labelIds !== undefined) patch.labelIds = normalizeLabelIds(updates.labelIds);
  if (updates.publicationStatus !== undefined) patch.publicationStatus = updates.publicationStatus;

  if (updates.status !== undefined) {
    // Sécurité métier : une tâche issue de mission ne peut jamais être clôturée directement par l'employé
    if (task.source === 'mission' && updates.status === 'completed' && actor.role === 'employee') {
      throw new Error('Une tâche de mission doit être soumise et validée par un responsable.');
    }
    patch.status = updates.status;
    if (updates.status === 'completed') {
      patch.progress = 100;
      patch.completedAt = serverTimestamp();
    }
  }

  if (updates.progress !== undefined && task.progressMode === 'manual') {
    const isCompleted = (updates.status ?? task.status) === 'completed';
    patch.progress = clampManualProgress(updates.progress, isCompleted);
    if (!updates.status && patch.progress && Number(patch.progress) > 0 && task.status === 'todo') {
      patch.status = 'in_progress';
    }
  }

  try {
    await updateDoc(doc(db, 'tasks', task.id), patch);

    // Synchroniser la visibilité des sous-tâches lors de la publication d'un brouillon
    if (updates.publicationStatus && updates.publicationStatus !== task.publicationStatus) {
      const subSnap = await getDocs(
        query(collection(db, 'tasks', task.id, 'subtasks'), where('ownerId', '==', task.ownerId))
      );
      if (!subSnap.empty) {
        const batch = writeBatch(db);
        subSnap.docs.forEach((s) => {
          batch.update(s.ref, { publicationStatus: updates.publicationStatus });
        });
        await batch.commit();
      }
    }

    // Si tâche issue de mission, synchroniser progression & statut sur missionAssignments
    if (task.source === 'mission' && task.assignmentId && (patch.progress !== undefined || patch.status !== undefined)) {
      const nextStatus = (patch.status as TaskStatus) || task.status;
      const mappedWorkStatus =
        nextStatus === 'blocked'
          ? 'blocked'
          : nextStatus === 'submitted'
          ? 'submitted'
          : 'in_progress';
      await updateDoc(doc(db, 'missionAssignments', task.assignmentId), {
        progress: patch.progress !== undefined ? patch.progress : task.progress,
        workStatus: mappedWorkStatus,
        updatedAt: serverTimestamp(),
      });
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: fullName,
      action:
        updates.status === 'completed'
          ? 'task_completed'
          : updates.publicationStatus === 'published' && task.publicationStatus === 'draft'
          ? 'task_published'
          : 'task_updated',
      entityType: 'task',
      entityId: task.id,
      metadata: {
        dueAt: updates.dueAt || task.dueAt,
        priority: updates.priority || task.priority,
        status: updates.status || task.status,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Suppression logique d'une tâche (conserve l'historique et l'audit).
 */
export async function softDeleteTask(actor: UserPrivate, task: Task): Promise<void> {
  const path = `tasks/${task.id}`;
  try {
    await updateDoc(doc(db, 'tasks', task.id), {
      status: 'cancelled',
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: `${actor.firstName} ${actor.lastName}`.trim(),
      action: 'task_soft_deleted',
      entityType: 'task',
      entityId: task.id,
      metadata: { title: task.title, publicationStatus: task.publicationStatus },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addSubtask(
  actor: UserPrivate,
  task: Task,
  title: string,
  description: string,
  currentSubtasks: Subtask[]
): Promise<void> {
  const path = `tasks/${task.id}/subtasks`;
  const cleanTitle = sanitizeText(title, 200);
  if (!cleanTitle) return;

  try {
    const subRef = doc(collection(db, 'tasks', task.id, 'subtasks'));
    await setDoc(subRef, {
      title: cleanTitle,
      description: sanitizeText(description, 1000) || null,
      order: currentSubtasks.length,
      completed: false,
      completedBy: null,
      completedAt: null,
      ownerId: task.ownerId,
      publicationStatus: task.publicationStatus,
      createdAt: serverTimestamp(),
    });

    const newTotal = currentSubtasks.length + 1;
    const completedCount = currentSubtasks.filter((s) => s.completed).length;
    const autoProgress = computeAutoProgress(completedCount, newTotal);
    const boundedProgress = task.status === 'completed' ? 100 : Math.min(99, autoProgress);

    await updateDoc(doc(db, 'tasks', task.id), {
      progressMode: 'auto',
      subtaskCount: newTotal,
      completedSubtaskCount: completedCount,
      progress: boundedProgress,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleSubtaskCompletion(
  actor: UserPrivate,
  task: Task,
  subtask: Subtask,
  allSubtasks: Subtask[]
): Promise<void> {
  const path = `tasks/${task.id}/subtasks/${subtask.id}`;
  const nextCompleted = !subtask.completed;

  try {
    await updateDoc(doc(db, 'tasks', task.id, 'subtasks', subtask.id), {
      completed: nextCompleted,
      completedBy: nextCompleted ? actor.uid : null,
      completedAt: nextCompleted ? serverTimestamp() : null,
    });

    const newCompletedCount = allSubtasks.reduce(
      (acc, s) => acc + (s.id === subtask.id ? (nextCompleted ? 1 : 0) : s.completed ? 1 : 0),
      0
    );
    const total = allSubtasks.length;
    const computed = computeAutoProgress(newCompletedCount, total);
    // 100 % réservé à la tâche officiellement terminée (ou prête à soumettre sur mission)
    const nextProgress =
      task.status === 'completed'
        ? 100
        : task.source === 'mission'
        ? Math.min(99, computed)
        : computed;

    const nextStatus: TaskStatus =
      (task.status === 'todo' && newCompletedCount > 0) || task.status === 'changes_requested'
        ? 'in_progress'
        : task.status;

    await updateDoc(doc(db, 'tasks', task.id), {
      progressMode: 'auto',
      subtaskCount: total,
      completedSubtaskCount: newCompletedCount,
      progress: nextProgress,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    if (task.source === 'mission' && task.assignmentId) {
      await updateDoc(doc(db, 'missionAssignments', task.assignmentId), {
        progress: nextProgress,
        workStatus: task.status === 'blocked' ? 'blocked' : 'in_progress',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeSubtask(
  task: Task,
  subtaskId: string,
  allSubtasks: Subtask[]
): Promise<void> {
  const path = `tasks/${task.id}/subtasks/${subtaskId}`;
  try {
    await deleteDoc(doc(db, 'tasks', task.id, 'subtasks', subtaskId));
    const remaining = allSubtasks.filter((s) => s.id !== subtaskId);
    const completedCount = remaining.filter((s) => s.completed).length;
    const nextMode = remaining.length > 0 ? 'auto' : 'manual';
    const nextProgress =
      remaining.length > 0
        ? Math.min(task.status === 'completed' ? 100 : 99, computeAutoProgress(completedCount, remaining.length))
        : 0;

    await updateDoc(doc(db, 'tasks', task.id), {
      progressMode: nextMode,
      subtaskCount: remaining.length,
      completedSubtaskCount: completedCount,
      progress: nextProgress,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeMyTasks(uid: string, onData: (tasks: Task[]) => void): () => void {
  const path = 'tasks';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))
        .filter((t) => !t.deletedAt)
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribePublishedTasks(onData: (tasks: Task[]) => void): () => void {
  const path = 'tasks';
  const q = query(collection(db, path), where('publicationStatus', '==', 'published'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))
        .filter((t) => !t.deletedAt)
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeTaskById(taskId: string, onData: (task: Task | null) => void): () => void {
  const path = `tasks/${taskId}`;
  return onSnapshot(
    doc(db, 'tasks', taskId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...(snap.data() as Omit<Task, 'id'>) });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeTaskSubtasks(
  taskId: string,
  ownerId: string,
  isPublished: boolean,
  onData: (subtasks: Subtask[]) => void
): () => void {
  const path = `tasks/${taskId}/subtasks`;
  const q = isPublished
    ? query(collection(db, 'tasks', taskId, 'subtasks'), where('publicationStatus', '==', 'published'))
    : query(collection(db, 'tasks', taskId, 'subtasks'), where('ownerId', '==', ownerId));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Subtask, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeTaskComments(
  taskId: string,
  visibility: 'company' | 'private',
  authorUid: string,
  onData: (comments: TaskComment[]) => void
): () => void {
  const path = 'comments';
  // Requête mono-champ conforme aux règles allow list (aucun index composite requis)
  const q =
    visibility === 'company'
      ? query(collection(db, path), where('visibility', '==', 'company'))
      : query(collection(db, path), where('authorId', '==', authorUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<TaskComment, 'id'>) }))
        .filter((c) => c.taskId === taskId)
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function addTaskComment(
  actor: UserPrivate,
  task: Task,
  content: string
): Promise<void> {
  const clean = sanitizeText(content, 2000);
  if (!clean) return;

  const path = 'comments';
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();
  try {
    const ref = doc(collection(db, path));
    const now = serverTimestamp();
    await setDoc(ref, {
      taskId: task.id,
      missionId: task.missionId || null,
      authorId: actor.uid,
      authorName: sanitizeText(fullName, 160),
      content: clean,
      visibility: task.publicationStatus === 'published' ? 'company' : 'private',
      createdAt: now,
      updatedAt: now,
    });

    if (task.ownerId !== actor.uid) {
      await createNotification({
        recipientId: task.ownerId,
        type: 'comment_added',
        title: `Nouveau commentaire sur « ${task.title} »`,
        message: `${fullName} a commenté : ${clean.slice(0, 140)}`,
        entityType: 'task',
        entityId: task.id,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
