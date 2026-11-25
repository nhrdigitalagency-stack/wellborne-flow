import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { TaskLabel, TaskLabelColor, TaskLabelGroup, UserPrivate } from '../../types';
import { sanitizeText } from '../../utils/taskUtils';
import { recordAuditLog } from '../audit/auditService';
import { db, handleFirestoreError, logFirestoreError, OperationType } from '../firebase/config';

export interface SaveTaskLabelInput {
  name: string;
  group: TaskLabelGroup;
  color: TaskLabelColor;
}

const GROUP_ORDER: Record<TaskLabelGroup, number> = {
  priority: 0,
  department: 1,
  project_type: 2,
};

export function subscribeTaskLabels(
  onData: (labels: TaskLabel[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'taskLabels';
  const q = query(collection(db, path), where('workspaceVisibility', '==', 'company'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<TaskLabel, 'id'>) }))
        .sort((a, b) => {
          const gDiff = (GROUP_ORDER[a.group] ?? 9) - (GROUP_ORDER[b.group] ?? 9);
          if (gDiff !== 0) return gDiff;
          return a.name.localeCompare(b.name, 'fr');
        });
      onData(list);
    },
    (error) => {
      logFirestoreError(error, OperationType.LIST, path);
      onError?.(error);
    }
  );
}

export async function createTaskLabel(
  actor: UserPrivate,
  input: SaveTaskLabelInput
): Promise<string> {
  const cleanName = sanitizeText(input.name, 40);
  if (!cleanName) {
    throw new Error('Le nom de l’étiquette est obligatoire.');
  }

  const ref = doc(collection(db, 'taskLabels'));
  const fullName = sanitizeText(`${actor.firstName} ${actor.lastName}`.trim(), 160);
  const now = serverTimestamp();

  try {
    await setDoc(ref, {
      name: cleanName,
      group: input.group,
      color: input.color,
      workspaceVisibility: 'company',
      createdBy: actor.uid,
      creatorName: fullName,
      createdAt: now,
      updatedAt: now,
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: fullName,
      action: 'label_created',
      entityType: 'label',
      entityId: ref.id,
      metadata: {
        name: cleanName,
        group: input.group,
        color: input.color,
      },
    });

    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `taskLabels/${ref.id}`);
  }
}

export async function updateTaskLabel(
  actor: UserPrivate,
  labelId: string,
  input: SaveTaskLabelInput
): Promise<void> {
  const cleanName = sanitizeText(input.name, 40);
  if (!cleanName) {
    throw new Error('Le nom de l’étiquette est obligatoire.');
  }

  const path = `taskLabels/${labelId}`;
  const fullName = sanitizeText(`${actor.firstName} ${actor.lastName}`.trim(), 160);

  try {
    await updateDoc(doc(db, 'taskLabels', labelId), {
      name: cleanName,
      group: input.group,
      color: input.color,
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: fullName,
      action: 'label_updated',
      entityType: 'label',
      entityId: labelId,
      metadata: {
        name: cleanName,
        group: input.group,
        color: input.color,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTaskLabel(
  actor: UserPrivate,
  label: TaskLabel
): Promise<void> {
  const path = `taskLabels/${label.id}`;
  const fullName = sanitizeText(`${actor.firstName} ${actor.lastName}`.trim(), 160);

  try {
    await deleteDoc(doc(db, 'taskLabels', label.id));

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: fullName,
      action: 'label_deleted',
      entityType: 'label',
      entityId: label.id,
      metadata: {
        name: label.name,
        group: label.group,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
