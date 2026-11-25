import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import {
  EmptyState,
  Modal,
  PriorityLabel,
  ProgressBar,
  TableSkeleton,
} from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  acceptMissionAssignment,
  rejectMissionAssignment,
} from '../../services/missions/missionService';
import type { MissionAssignment } from '../../types';
import { formatDateFR, formatTimestampFR } from '../../utils/dateUtils';
import { matchesKeywords } from '../../utils/searchUtils';
import { ACCEPTANCE_LABELS, WORK_STATUS_LABELS } from '../../utils/taskUtils';

export function MyMissionsPage() {
  const { profile } = useAuth();
  const { myAssignments, employeeMissions, dataReady, globalSearchQuery, setGlobalSearchQuery } =
    useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MissionAssignment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const missionMap = useMemo(
    () => new Map(employeeMissions.map((m) => [m.id, m])),
    [employeeMissions]
  );

  const filtered = useMemo(() => {
    return myAssignments.filter((a) => {
      if (filter !== 'all' && a.acceptanceStatus !== filter) return false;
      if (globalSearchQuery.trim()) {
        const mission = missionMap.get(a.missionId);
        return matchesKeywords(globalSearchQuery, [
          a.missionTitle,
          a.assignedByName,
          mission?.description,
          mission?.objectives,
          mission?.instructions,
          mission?.category,
        ]);
      }
      return true;
    });
  }, [myAssignments, filter, globalSearchQuery, missionMap]);

  const handleAccept = async (assignment: MissionAssignment) => {
    if (!profile) return;
    setBusyId(assignment.id);
    try {
      const taskId = await acceptMissionAssignment(profile, assignment);
      showToast('Mission acceptée. Votre tâche individuelle a été créée automatiquement.');
      navigate(`/taches/${taskId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l’acceptation', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectMissionAssignment(profile, rejectTarget, rejectReason);
      showToast('Refus enregistré. Le responsable a été notifié.');
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du refus', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (!dataReady) return <TableSkeleton rows={5} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Mes missions attribuées
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Chaque mission dispose d’une affectation et d’une progression strictement indépendantes.
          </p>
        </div>

        <div className="inline-flex items-center bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-1 self-start">
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'pending', label: 'En attente' },
              { id: 'accepted', label: 'Acceptées' },
              { id: 'rejected', label: 'Refusées' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                  : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {globalSearchQuery.trim() && (
        <div className="bg-[#EAF2FC] dark:bg-[#172A45] border border-[#3578C8]/25 dark:border-blue-500/30 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#172D4D] dark:text-slate-100">
          <span>
            Missions filtrées par la recherche globale : <strong>« {globalSearchQuery.trim()} »</strong>
          </span>
          <button
            type="button"
            onClick={() => setGlobalSearchQuery('')}
            className="font-semibold text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            Effacer le filtre global
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune mission dans cette catégorie"
          description="Lorsque votre responsable vous attribuera une mission, elle apparaîtra ici avec une notification dédiée."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((assignment) => {
            const mission = missionMap.get(assignment.missionId);
            const isBusy = busyId === assignment.id;
            return (
              <article
                key={assignment.id}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400">
                      <PriorityLabel priority={assignment.priority} />
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#172D4D] dark:text-slate-200">
                        {ACCEPTANCE_LABELS[assignment.acceptanceStatus]}
                      </span>
                      {assignment.acceptanceStatus === 'accepted' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#3578C8] dark:text-blue-400 font-medium">
                            {WORK_STATUS_LABELS[assignment.workStatus]}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Attribuée par {assignment.assignedByName}</span>
                    </div>
                    <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">
                      {assignment.missionTitle}
                    </h2>
                    {mission?.description && (
                      <p className="text-sm text-[#667085] dark:text-slate-300 leading-relaxed">
                        {mission.description}
                      </p>
                    )}
                    {mission?.objectives && (
                      <p className="text-xs text-[#172D4D] dark:text-slate-200 pt-1">
                        <strong>Objectifs :</strong> {mission.objectives}
                      </p>
                    )}
                    {mission?.instructions && (
                      <p className="text-xs text-[#667085] dark:text-slate-400">
                        <strong>Instructions :</strong> {mission.instructions}
                      </p>
                    )}
                  </div>

                  <div className="lg:w-64 shrink-0 space-y-3">
                    <div className="text-xs text-[#667085] dark:text-slate-400 flex items-center justify-between">
                      <span>Échéance</span>
                      <span className="font-mono-num font-semibold text-[#172D4D] dark:text-slate-100">
                        {formatDateFR(assignment.dueAt)}
                      </span>
                    </div>
                    {assignment.acceptanceStatus === 'accepted' && (
                      <ProgressBar value={assignment.progress} />
                    )}

                    {assignment.acceptanceStatus === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAccept(assignment)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#16A36A] text-white rounded-lg hover:bg-[#138a59] cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Accepter
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setRejectTarget(assignment);
                            setRejectReason('');
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-[#DC4545] dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Refuser
                        </button>
                      </div>
                    )}

                    {assignment.acceptanceStatus === 'accepted' && assignment.taskId && (
                      <Link
                        to={`/taches/${assignment.taskId}`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8]"
                      >
                        Ouvrir ma tâche d’exécution
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {assignment.acceptanceStatus === 'rejected' && assignment.rejectionReason && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-[#DC4545] dark:text-red-400">
                    <strong>Motif de refus enregistré :</strong> {assignment.rejectionReason}
                  </div>
                )}

                {assignment.reviewComment && (
                  <div
                    className={`p-3 rounded-lg border text-xs ${
                      assignment.workStatus === 'approved'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-[#172D4D] dark:text-slate-100'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-[#172D4D] dark:text-slate-100'
                    }`}
                  >
                    <strong>
                      Observation du responsable ({formatTimestampFR(assignment.reviewedAt)}) :
                    </strong>{' '}
                    {assignment.reviewComment}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(rejectTarget)}
        title="Refuser cette mission"
        onClose={() => setRejectTarget(null)}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <p className="text-sm text-[#667085] dark:text-slate-400">
            Veuillez indiquer le motif de votre refus pour la mission{' '}
            <strong className="text-[#172D4D] dark:text-slate-100">{rejectTarget?.missionTitle}</strong>. Votre
            responsable recevra une notification. Le refus n’affecte pas les autres collaborateurs.
          </p>
          <div>
            <label htmlFor="reject-reason" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Motif du refus *
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              required
              minLength={3}
              maxLength={1000}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex. Surcharge sur la mission prioritaire en cours, délai incompatible…"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 text-sm text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busyId !== null}
              className="px-4 py-2 text-sm font-semibold bg-[#DC4545] text-white rounded-lg hover:bg-[#b91c1c] cursor-pointer disabled:opacity-50"
            >
              Confirmer le refus
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
