import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { ActivityReport, ReportTotals, UserPrivate } from '../../types';
import { sanitizeText } from '../../utils/taskUtils';
import { recordAuditLog } from '../audit/auditService';
import { db, handleFirestoreError, logFirestoreError, OperationType } from '../firebase/config';

export async function saveReportSnapshot(
  actor: UserPrivate,
  params: {
    type: 'individual' | 'collective';
    periodKind: 'weekly' | 'monthly' | 'custom';
    employeeId?: string | null;
    employeeName?: string | null;
    periodStart: string;
    periodEnd: string;
    totals: ReportTotals;
    completionRate: number;
  }
): Promise<string> {
  const reportRef = doc(collection(db, 'reports'));
  const reportId = reportRef.id;
  const path = `reports/${reportId}`;

  try {
    await setDoc(reportRef, {
      type: params.type,
      periodKind: params.periodKind,
      employeeId: params.employeeId || null,
      employeeName: params.employeeName ? sanitizeText(params.employeeName, 160) : null,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      totals: params.totals,
      completionRate: params.completionRate,
      generatedBy: actor.uid,
      generatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorName: `${actor.firstName} ${actor.lastName}`.trim(),
      action: 'report_generated',
      entityType: 'report',
      entityId: reportId,
      metadata: {
        type: params.type,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        completionRate: params.completionRate,
      },
    });

    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeSavedReports(
  uid: string,
  isBootstrapAdmin: boolean,
  isManager: boolean,
  onData: (reports: ActivityReport[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'reports';
  const q = isBootstrapAdmin
    ? query(collection(db, path))
    : isManager
    ? query(collection(db, path), where('generatedBy', '==', uid))
    : query(collection(db, path), where('employeeId', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityReport, 'id'>) }))
        .sort((a, b) => (b.generatedAt?.toMillis?.() || 0) - (a.generatedAt?.toMillis?.() || 0));
      onData(list);
    },
    (error) => {
      logFirestoreError(error, OperationType.LIST, path);
      onError?.(error);
    }
  );
}
