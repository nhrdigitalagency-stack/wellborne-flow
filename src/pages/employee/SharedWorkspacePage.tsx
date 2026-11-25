import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Tag } from 'lucide-react';
import {
  LABEL_GROUP_LABELS,
  LABEL_GROUP_ORDER,
  LabelManagerModal,
  TaskLabelInlineList,
} from '../../components/tasks/TaskLabels';
import {
  EmptyState,
  PriorityLabel,
  ProgressBar,
  StatusLabel,
  TableSkeleton,
} from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import type { TaskLabel, TaskLabelGroup, TaskPriority, TaskStatus } from '../../types';
import { formatDateFR, getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';
import { getTaskLabelNames, matchesKeywords } from '../../utils/searchUtils';
import { PRIORITY_LABELS, STATUS_LABELS, TASK_CATEGORIES } from '../../utils/taskUtils';

export function SharedWorkspacePage({
  title = 'Espace commun de l’entreprise',
  subtitle = 'Toutes les tâches publiées par les collaborateurs. Lecture transparente, modification réservée au propriétaire.',
}: {
  title?: string;
  subtitle?: string;
}) {
  const { profile } = useAuth();
  const {
    publishedTasks,
    taskLabels,
    taskLabelMap,
    teamDirectory,
    dataReady,
    globalSearchQuery,
    setGlobalSearchQuery,
  } = useWorkspace();
  const todayISO = getTodayDoualaISO();

  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  const groupedLabels = useMemo(() => {
    const map: Record<TaskLabelGroup, TaskLabel[]> = {
      priority: [],
      department: [],
      project_type: [],
    };
    for (const l of taskLabels) {
      if (map[l.group]) map[l.group].push(l);
    }
    return map;
  }, [taskLabels]);

  const filtered = useMemo(() => {
    const combinedQuery = `${globalSearchQuery} ${search}`.trim();
    return publishedTasks.filter((t) => {
      if (
        combinedQuery &&
        !matchesKeywords(combinedQuery, [
          t.title,
          t.description,
          t.category,
          t.ownerName,
          t.creatorName,
          ...getTaskLabelNames(t, taskLabelMap),
        ])
      ) {
        return false;
      }
      if (employeeFilter !== 'all' && t.ownerId !== employeeFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (statusFilter === 'overdue') {
        if (!isTaskOverdue(t.dueAt, t.status, todayISO)) return false;
      } else if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (labelFilter !== 'all' && !(t.labelIds || []).includes(labelFilter)) return false;
      if (dateFrom && t.dueAt < dateFrom) return false;
      if (dateTo && t.dueAt > dateTo) return false;
      return true;
    });
  }, [
    publishedTasks,
    taskLabelMap,
    search,
    globalSearchQuery,
    employeeFilter,
    priorityFilter,
    statusFilter,
    categoryFilter,
    labelFilter,
    dateFrom,
    dateTo,
    todayISO,
  ]);

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            {title}
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setLabelModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          <Tag className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
          Gérer les étiquettes
        </button>
      </div>

      {globalSearchQuery.trim() && (
        <div className="bg-[#EAF2FC] dark:bg-[#172A45] border border-[#3578C8]/25 dark:border-blue-400/30 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#172D4D] dark:text-blue-100">
          <span>
            Filtre global actif : <strong>« {globalSearchQuery.trim()} »</strong>
          </span>
          <button
            type="button"
            onClick={() => setGlobalSearchQuery('')}
            className="font-semibold text-[#3578C8] dark:text-blue-300 hover:underline cursor-pointer whitespace-nowrap"
          >
            Effacer le filtre global
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[#667085] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, description, collaborateur ou étiquette…"
              aria-label="Rechercher dans l’espace commun"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
            />
          </div>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            aria-label="Filtrer par collaborateur"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Tous les collaborateurs</option>
            {teamDirectory.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrer par statut"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Tous les statuts</option>
            <option value="overdue">En retard</option>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filtrer par priorité"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Toutes priorités</option>
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrer par catégorie"
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Toutes catégories</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            aria-label="Filtrer par étiquette personnalisée"
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Toutes étiquettes</option>
            {LABEL_GROUP_ORDER.map((group) =>
              groupedLabels[group].length > 0 ? (
                <optgroup key={group} label={LABEL_GROUP_LABELS[group]}>
                  {groupedLabels[group].map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ) : null
            )}
          </select>

          <label className="inline-flex items-center gap-1.5 text-[#667085] dark:text-slate-400">
            <span>Échéance du</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-md font-mono-num text-[#172D4D] dark:text-slate-100"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-[#667085] dark:text-slate-400">
            <span>au</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-md font-mono-num text-[#172D4D] dark:text-slate-100"
            />
          </label>

          <span className="ml-auto text-[#667085] dark:text-slate-400 font-mono-num">
            {filtered.length} publication{filtered.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune tâche publiée trouvée"
          description="Les tâches enregistrées en brouillon restent privées. Les tâches publiées par l’équipe apparaissent ici en temps réel."
        />
      ) : (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs font-semibold text-[#667085] dark:text-slate-400">
                  <th className="py-3 px-4">Tâche</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Priorité</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Échéance</th>
                  <th className="py-3 px-4">Progression</th>
                  <th className="py-3 px-4 text-right">Consultation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.map((task) => {
                  const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
                  const isMine = task.ownerId === profile?.uid;
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3.5 px-4 max-w-sm">
                        <Link
                          to={`/taches/${task.id}`}
                          className="font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                        >
                          {task.title}
                        </Link>
                        <p className="text-xs text-[#667085] dark:text-slate-400 truncate mt-0.5">
                          {task.description}
                        </p>
                        <TaskLabelInlineList
                          labelIds={task.labelIds}
                          labelMap={taskLabelMap}
                          maxVisible={3}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#172D4D] dark:text-slate-200 whitespace-nowrap">
                        <span className="font-medium">{task.ownerName}</span>
                        {task.creatorName !== task.ownerName && (
                          <span className="block text-[11px] text-[#667085] dark:text-slate-400">
                            Par {task.creatorName}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <PriorityLabel priority={task.priority} />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusLabel status={task.status} overdue={overdue} />
                      </td>
                      <td className="py-3.5 px-4 font-mono-num text-xs text-[#172D4D] dark:text-slate-200 whitespace-nowrap">
                        {formatDateFR(task.dueAt)}
                      </td>
                      <td className="py-3.5 px-4 w-36">
                        <ProgressBar value={task.progress} overdue={overdue} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/taches/${task.id}`}
                          className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline"
                        >
                          {isMine ? 'Gérer' : 'Consulter'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LabelManagerModal open={labelModalOpen} onClose={() => setLabelModalOpen(false)} />
    </div>
  );
}
