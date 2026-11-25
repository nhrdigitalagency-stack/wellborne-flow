import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { AuditLog } from '../../types';
import { sanitizeText } from '../../utils/taskUtils';
import { db, logFirestoreError, OperationType } from '../firebase/config';

export interface LogAuditInput {
  actorUid: string;
  actorName: string;
  action: string;
  entityType: AuditLog['entityType'];
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(input: LogAuditInput): Promise<void> {
  const path = 'auditLogs';
  try {
    const ref = doc(collection(db, path));
    const payload: Record<string, unknown> = {
      actorUid: input.actorUid,
      actorName: sanitizeText(input.actorName || 'Utilisateur', 160),
      action: sanitizeText(input.action, 80),
      entityType: input.entityType,
      entityId: sanitizeText(input.entityId, 128),
      timestamp: serverTimestamp(),
    };
    if (input.metadata) {
      payload.metadata = input.metadata;
    }
    await setDoc(ref, payload);
  } catch (error) {
    // Journalisation non bloquante sur console mais remontée si permission refusée
    console.warn('Audit log non enregistré:', error);
  }
}

export function subscribeAuditLogs(
  actorUid: string,
  isBootstrapAdmin: boolean,
  onData: (logs: AuditLog[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'auditLogs';
  // Requête mono-champ pour éviter toute dépendance à un index composite
  const q = isBootstrapAdmin
    ? query(collection(db, path), orderBy('timestamp', 'desc'), limit(100))
    : query(collection(db, path), where('actorUid', '==', actorUid));

  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
        .slice(0, isBootstrapAdmin ? 100 : 60);
      onData(logs);
    },
    (error) => {
      logFirestoreError(error, OperationType.LIST, path);
      onError?.(error);
    }
  );
}
