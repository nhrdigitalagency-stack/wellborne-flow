import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, RotateCcw } from 'lucide-react';
import { EmptyState, Modal, ProgressBar, TableSkeleton } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { reviewMissionSubmission } from '../../services/missions/missionService';
import type { MissionAssignment } from '../../types';
import { formatDateFR, formatTimestampFR } from '../../utils/dateUtils';
import { WORK_STATUS_LABELS } from '../../utils/taskUtils';

export function ValidationsPage() {
  const { profile } = useAuth();
  const { managedAssignments, dataReady } = useWorkspace();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const [reviewTarget, setReviewTarget] = useState<{
    assignment: MissionAssignment;
    decision: 'approved' | 'changes_requested';
  } | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const pendingItems = useMemo(
    () => managedAssignments.filter((a) => a.workStatus === 'submitted'),
    [managedAssignments]
  );

  const reviewedItems = useMemo(
    () =>
      managedAssignments.filter(
        (a) => a.workStatus === 'approved' || a.workStatus === 'changes_requested'
      ),
    [managedAssignments]
  );

  const items = tab === 'pending' ? pendingItems : reviewedItems;

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reviewTarget) return;
    setSaving(true);
    try {
      await reviewMissionSubmission(
        profile,
        reviewTarget.assignment,
        reviewTarget.decision,
        comment
      );
      showToast(
        reviewTarget.decision === 'approved'
          ? 'Travail approuvé : la mission et la tâche associée sont désormais terminées.'
          : 'Demande de corrections envoyée au collaborateur.'
      );
      setReviewTarget(null);
      setComment('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de validation', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!dataReady) return <TableSkeleton rows={5} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Centre de validation des travaux
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Approuvez les missions soumises ou demandez des ajustements avec observation tracée.
          </p>
        </div>

        <div className="inline-flex items-center bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-1 self-start">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'pending'
                ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
            }`}
          >
            À valider ({pendingItems.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('reviewed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'reviewed'
                ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
            }`}
          >
            Historique ({reviewedItems.length})
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={
            tab === 'pending'
              ? 'Aucune soumission en attente'
              : 'Aucune validation enregistrée'
          }
          description="Lorsqu’un collaborateur soumet son travail sur une mission, il apparaît immédiatement ici pour contrôle."
        />
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <article
              key={a.id}
              className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400">
                    <span className="font-semibold text-[#172D4D] dark:text-slate-200">{a.employeeName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{WORK_STATUS_LABELS[a.workStatus]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      Soumis le {formatTimestampFR(a.submittedAt)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">Échéance {formatDateFR(a.dueAt)}</span>
                  </div>
                  <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">{a.missionTitle}</h2>
                  {a.submissionNote && (
                    <div className="p-3 bg-[#F4F6FA] dark:bg-[#0F172A] rounded-lg text-sm text-[#172D4D] dark:text-slate-200 mt-2">
                      <span className="text-xs font-semibold text-[#667085] dark:text-slate-400 block mb-0.5">
                        Note du collaborateur :
                      </span>
                      {a.submissionNote}
                    </div>
                  )}
                  {a.reviewComment && tab === 'reviewed' && (
                    <div className="p-3 bg-[#EAF2FC] dark:bg-[#172A45] rounded-lg text-xs text-[#172D4D] dark:text-slate-100 mt-2">
                      <strong>Décision ({formatTimestampFR(a.reviewedAt)}) :</strong> {a.reviewComment}
                    </div>
                  )}
                </div>

                <div className="lg:w-64 shrink-0 space-y-3">
                  <ProgressBar value={a.progress} />
                  {a.taskId && (
                    <Link
                      to={`/taches/${a.taskId}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-[#3578C8] dark:hover:border-blue-400"
                    >
                      Consulter les étapes <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {tab === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget({ assignment: a, decision: 'approved' });
                          setComment('');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-[#16A36A] hover:bg-[#138a59] text-white rounded-lg cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget({ assignment: a, decision: 'changes_requested' });
                          setComment('');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-white dark:bg-[#0F172A] border border-amber-300 dark:border-amber-700 text-[#D97706] dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Corriger
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(reviewTarget)}
        title={
          reviewTarget?.decision === 'approved'
            ? 'Approuver le travail soumis'
            : 'Demander des corrections'
        }
        onClose={() => setReviewTarget(null)}
      >
        <form onSubmit={handleConfirmReview} className="space-y-4">
          <p className="text-sm text-[#667085] dark:text-slate-400">
            {reviewTarget?.decision === 'approved'
              ? `En approuvant le travail de ${reviewTarget.assignment.employeeName}, l’affectation et la tâche associée passeront définitivement à « Terminée » (100 %).`
              : `Précisez les ajustements attendus pour ${reviewTarget?.assignment.employeeName}. La tâche repassera au statut « Corrections demandées ».`}
          </p>
          <div>
            <label htmlFor="review-comment" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Observation {reviewTarget?.decision === 'changes_requested' ? '*' : '(facultatif)'}
            </label>
            <textarea
              id="review-comment"
              rows={4}
              required={reviewTarget?.decision === 'changes_requested'}
              minLength={reviewTarget?.decision === 'changes_requested' ? 3 : 0}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                reviewTarget?.decision === 'approved'
                  ? 'Ex. Travail conforme aux objectifs, validé.'
                  : 'Ex. Veuillez compléter l’étape 4 et vérifier les tests mobiles.'
              }
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setReviewTarget(null)}
              className="px-4 py-2 text-sm text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-lg cursor-pointer disabled:opacity-50 ${
                reviewTarget?.decision === 'approved'
                  ? 'bg-[#16A36A] hover:bg-[#138a59]'
                  : 'bg-[#D97706] hover:bg-[#b45309]'
              }`}
            >
              {saving
                ? 'Enregistrement…'
                : reviewTarget?.decision === 'approved'
                ? 'Confirmer l’approbation'
                : 'Envoyer la demande'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
