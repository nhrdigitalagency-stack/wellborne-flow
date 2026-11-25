import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, Plus } from 'lucide-react';
import {
  EmptyState,
  PriorityLabel,
  ProgressBar,
  TableSkeleton,
} from '../../components/ui/Primitives';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatDateFR } from '../../utils/dateUtils';
import { matchesKeywords } from '../../utils/searchUtils';
import { ACCEPTANCE_LABELS, WORK_STATUS_LABELS } from '../../utils/taskUtils';

export function AllMissionsPage() {
  const { managedMissions, managedAssignments, dataReady, globalSearchQuery, setGlobalSearchQuery } =
    useWorkspace();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const assignmentsByMission = useMemo(() => {
    const map = new Map<string, typeof managedAssignments>();
    for (const a of managedAssignments) {
      const list = map.get(a.missionId) || [];
      list.push(a);
      map.set(a.missionId, list);
    }
    return map;
  }, [managedAssignments]);

  const filteredMissions = useMemo(() => {
    if (!globalSearchQuery.trim()) return managedMissions;
    return managedMissions.filter((m) => {
      const assigns = assignmentsByMission.get(m.id) || [];
      const assigneeNames = assigns.map((a) => a.employeeName).join(' ');
      return matchesKeywords(globalSearchQuery, [
        m.title,
        m.description,
        m.objectives,
        m.instructions,
        m.category,
        m.creatorName,
        assigneeNames,
      ]);
    });
  }, [managedMissions, assignmentsByMission, globalSearchQuery]);

  if (!dataReady) return <TableSkeleton rows={5} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Suivi de toutes les missions
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Inspectez individuellement chaque collaborateur affecté : acceptation, progression et validation indépendantes.
          </p>
        </div>
        <Link
          to="/missions/nouvelle"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#3578C8] hover:bg-[#2a63a8] rounded-lg whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          Créer une mission
        </Link>
      </div>

      {globalSearchQuery.trim() && (
        <div className="bg-[#EAF2FC] dark:bg-[#172A45] border border-[#3578C8]/25 dark:border-blue-500/30 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#172D4D] dark:text-slate-100">
          <span>
            Missions filtrées par la recherche globale : <strong>« {globalSearchQuery.trim()} »</strong> ({filteredMissions.length} résultat{filteredMissions.length > 1 ? 's' : ''})
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

      {filteredMissions.length === 0 ? (
        <EmptyState
          title={
            globalSearchQuery.trim()
              ? 'Aucune mission ne correspond à votre recherche'
              : 'Aucune mission publiée'
          }
          description={
            globalSearchQuery.trim()
              ? 'Modifiez ou effacez les mots-clés saisis dans la barre de recherche globale.'
              : 'Créez votre première mission et attribuez-la à un ou plusieurs collaborateurs.'
          }
          action={
            globalSearchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                className="px-4 py-2 text-sm font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg cursor-pointer"
              >
                Effacer la recherche
              </button>
            ) : (
              <Link
                to="/missions/nouvelle"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#3578C8] text-white rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Créer une mission
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredMissions.map((mission) => {
            const assigns = assignmentsByMission.get(mission.id) || [];
            const acceptedCount = assigns.filter((a) => a.acceptanceStatus === 'accepted').length;
            const rejectedCount = assigns.filter((a) => a.acceptanceStatus === 'rejected').length;
            const pendingCount = assigns.filter((a) => a.acceptanceStatus === 'pending').length;
            const approvedCount = assigns.filter((a) => a.workStatus === 'approved').length;
            const isOpen = expandedId === mission.id || filteredMissions.length <= 3;

            return (
              <section
                key={mission.id}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === mission.id ? null : mission.id)}
                  className="w-full text-left px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mb-1">
                      <PriorityLabel priority={mission.priority} />
                      <span aria-hidden="true">·</span>
                      <span>{mission.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">Échéance {formatDateFR(mission.dueAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {pendingCount > 0
                          ? `${pendingCount} réponse${pendingCount > 1 ? 's' : ''} en attente`
                          : 'Toutes les réponses reçues'}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">{mission.title}</h2>
                  </div>

                  <div className="flex items-center gap-5 shrink-0 text-xs font-mono-num">
                    <span className="text-[#172D4D] dark:text-slate-200">
                      <strong>{assigns.length}</strong> affecté{assigns.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-[#3578C8] dark:text-blue-400">
                      <strong>{acceptedCount}</strong> accept.
                    </span>
                    <span className="text-[#16A36A] dark:text-emerald-400">
                      <strong>{approvedCount}</strong> valid.
                    </span>
                    {rejectedCount > 0 && (
                      <span className="text-[#DC4545] dark:text-red-400">
                        <strong>{rejectedCount}</strong> refus
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#667085] dark:text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#667085] dark:text-slate-400" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-700/80">
                    {mission.description && (
                      <div className="px-5 py-3 bg-[#F4F6FA]/50 dark:bg-[#0F172A]/60 text-xs text-[#667085] dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                        {mission.description}
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs font-semibold text-[#667085] dark:text-slate-400">
                            <th className="py-2.5 px-5">Collaborateur</th>
                            <th className="py-2.5 px-4">Acceptation</th>
                            <th className="py-2.5 px-4">État d’exécution</th>
                            <th className="py-2.5 px-4">Progression individuelle</th>
                            <th className="py-2.5 px-5 text-right">Suivi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {assigns.map((a) => (
                            <tr key={a.id}>
                              <td className="py-3 px-5 font-medium text-[#172D4D] dark:text-slate-100">
                                {a.employeeName}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                <span
                                  className={
                                    a.acceptanceStatus === 'accepted'
                                      ? 'text-[#16A36A] dark:text-emerald-400 font-medium'
                                      : a.acceptanceStatus === 'rejected'
                                      ? 'text-[#DC4545] dark:text-red-400 font-semibold'
                                      : 'text-[#D97706] dark:text-amber-400 font-medium'
                                  }
                                >
                                  {ACCEPTANCE_LABELS[a.acceptanceStatus]}
                                </span>
                                {a.rejectionReason && (
                                  <p className="text-[11px] text-[#667085] dark:text-slate-400 mt-0.5 max-w-xs">
                                    Motif : {a.rejectionReason}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs text-[#172D4D] dark:text-slate-200">
                                {WORK_STATUS_LABELS[a.workStatus]}
                              </td>
                              <td className="py-3 px-4 w-44">
                                <ProgressBar value={a.progress} />
                              </td>
                              <td className="py-3 px-5 text-right whitespace-nowrap">
                                {a.workStatus === 'submitted' ? (
                                  <Link
                                    to="/validations"
                                    className="text-xs font-semibold text-[#D97706] dark:text-amber-400 hover:underline"
                                  >
                                    Examiner la soumission
                                  </Link>
                                ) : a.taskId ? (
                                  <Link
                                    to={`/taches/${a.taskId}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline"
                                  >
                                    Voir tâche <ExternalLink className="w-3 h-3" />
                                  </Link>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
