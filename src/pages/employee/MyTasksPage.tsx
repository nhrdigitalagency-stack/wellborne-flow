import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Columns3, LayoutGrid, List, Plus, Search, Tag } from 'lucide-react';
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
import { useWorkspace } from '../../context/WorkspaceContext';
import type { TaskLabel, TaskLabelGroup, TaskPriority, TaskStatus } from '../../types';
import { formatDateFR, getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';
import { getTaskLabelNames, matchesKeywords } from '../../utils/searchUtils';
import { PRIORITY_LABELS, STATUS_LABELS, TASK_CATEGORIES } from '../../utils/taskUtils';

type ViewMode = 'table' | 'cards' | 'kanban';
const PAGE_SIZE = 12;

export function MyTasksPage() {
  const {
    myTasks,
    taskLabels,
    taskLabelMap,
    dataReady,
    globalSearchQuery,
    setGlobalSearchQuery,
  } = useWorkspace();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('statut') || 'all';

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [pubFilter, setPubFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueAt' | 'updatedAt' | 'priority'>('dueAt');
  const [page, setPage] = useState(1);
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  const todayISO = getTodayDoualaISO();

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

  const filteredTasks = useMemo(() => {
    const combinedQuery = `${globalSearchQuery} ${search}`.trim();
    const priorityRank: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

    return myTasks
      .filter((t) => {
        if (
          combinedQuery &&
          !matchesKeywords(combinedQuery, [
            t.title,
            t.description,
            t.category,
            t.ownerName,
            ...getTaskLabelNames(t, taskLabelMap),
          ])
        ) {
          return false;
        }
        if (statusFilter === 'overdue') {
          if (!isTaskOverdue(t.dueAt, t.status, todayISO)) return false;
        } else if (statusFilter !== 'all' && t.status !== statusFilter) {
          return false;
        }
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (labelFilter !== 'all' && !(t.labelIds || []).includes(labelFilter)) return false;
        if (pubFilter !== 'all' && t.publicationStatus !== pubFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority];
        if (sortBy === 'updatedAt') {
          return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
        }
        return (a.dueAt || '').localeCompare(b.dueAt || '');
      });
  }, [
    myTasks,
    taskLabelMap,
    search,
    globalSearchQuery,
    statusFilter,
    priorityFilter,
    categoryFilter,
    labelFilter,
    pubFilter,
    sortBy,
    todayISO,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const paginatedTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kanbanColumns: Array<{ key: TaskStatus; label: string }> = [
    { key: 'todo', label: 'À faire' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'blocked', label: 'En attente' },
    { key: 'submitted', label: 'Soumise' },
    { key: 'completed', label: 'Terminée' },
  ];

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Mes tâches
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            {filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''} affichée
            {filteredTasks.length > 1 ? 's' : ''} · Tâches personnelles et missions acceptées
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                  : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tableau
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                  : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cartes
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                  : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLabelModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Tag className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
            Étiquettes
          </button>
          <Link
            to="/taches/nouvelle"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#3578C8] text-white text-sm font-medium rounded-lg hover:bg-[#2a63a8] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nouvelle tâche
          </Link>
        </div>
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

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[#667085] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par titre, description ou étiquette…"
              aria-label="Rechercher une tâche"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par statut"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
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
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par priorité"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
          >
            <option value="all">Toutes priorités</option>
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par catégorie"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
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
            onChange={(e) => {
              setLabelFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par étiquette personnalisée"
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
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
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            value={pubFilter}
            onChange={(e) => {
              setPubFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par publication"
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
          >
            <option value="all">Toutes publications</option>
            <option value="published">Publiées</option>
            <option value="draft">Brouillons</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'dueAt' | 'updatedAt' | 'priority')}
            aria-label="Trier les tâches"
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
          >
            <option value="dueAt">Trier par échéance</option>
            <option value="priority">Trier par priorité</option>
            <option value="updatedAt">Plus récentes</option>
          </select>
          {labelFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setLabelFilter('all')}
              className="text-[#3578C8] dark:text-blue-400 font-semibold hover:underline cursor-pointer"
            >
              Réinitialiser l’étiquette
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="Aucune tâche ne correspond à vos filtres"
          description="Créez une nouvelle tâche personnelle ou ajustez vos critères de recherche."
          action={
            <Link
              to="/taches/nouvelle"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3578C8] text-white rounded-lg hover:bg-[#2a63a8]"
            >
              <Plus className="w-4 h-4" />
              Créer une tâche
            </Link>
          }
        />
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs font-semibold text-[#667085] dark:text-slate-400">
                  <th className="py-3 px-4">Tâche</th>
                  <th className="py-3 px-4">Priorité</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Échéance</th>
                  <th className="py-3 px-4">Progression</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {paginatedTasks.map((task) => {
                  const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          to={`/taches/${task.id}`}
                          className="font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                        >
                          {task.title}
                        </Link>
                        <div className="text-xs text-[#667085] dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{task.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {task.publicationStatus === 'draft' ? 'Brouillon privé' : 'Publiée'}
                          </span>
                          {task.source === 'mission' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#3578C8] dark:text-blue-400 font-medium">
                                Mission
                              </span>
                            </>
                          )}
                        </div>
                        <TaskLabelInlineList
                          labelIds={task.labelIds}
                          labelMap={taskLabelMap}
                          maxVisible={3}
                        />
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
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/taches/${task.id}`}
                          className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline whitespace-nowrap"
                        >
                          Détails
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs text-[#667085] dark:text-slate-400">
              <span>
                Page {page} sur {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md disabled:opacity-40 cursor-pointer"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md disabled:opacity-40 cursor-pointer"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedTasks.map((task) => {
            const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
            return (
              <Link
                key={task.id}
                to={`/taches/${task.id}`}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 hover:border-[#3578C8] dark:hover:border-blue-400 transition-colors flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mb-1.5">
                    <span>{task.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{task.publicationStatus === 'draft' ? 'Brouillon' : 'Publiée'}</span>
                    {task.source === 'mission' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#3578C8] dark:text-blue-400 font-medium">
                          Mission
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[#172D4D] dark:text-slate-100 mb-1.5 line-clamp-2">
                    {task.title}
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-slate-400 line-clamp-2">
                    {task.description}
                  </p>
                  <TaskLabelInlineList
                    labelIds={task.labelIds}
                    labelMap={taskLabelMap}
                    maxVisible={3}
                  />
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <ProgressBar value={task.progress} overdue={overdue} />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <StatusLabel status={task.status} overdue={overdue} />
                    <span className="font-mono-num text-[#667085] dark:text-slate-400">
                      {formatDateFR(task.dueAt)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {kanbanColumns.map((col) => {
            const items = filteredTasks.filter((t) =>
              col.key === 'in_progress'
                ? t.status === 'in_progress' || t.status === 'changes_requested'
                : t.status === col.key
            );
            return (
              <div
                key={col.key}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg flex flex-col"
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172D4D] dark:text-slate-100">
                    {col.label}
                  </span>
                  <span className="text-xs font-mono-num text-[#667085] dark:text-slate-400">
                    {items.length}
                  </span>
                </div>
                <div className="p-3 space-y-2.5 flex-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                      Aucune tâche
                    </p>
                  ) : (
                    items.map((task) => {
                      const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
                      return (
                        <Link
                          key={task.id}
                          to={`/taches/${task.id}`}
                          className="block p-3 rounded-lg bg-[#F4F6FA] dark:bg-[#0F172A] hover:bg-[#EAF2FC] dark:hover:bg-[#172A45] transition-colors space-y-2"
                        >
                          <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100 line-clamp-2">
                            {task.title}
                          </p>
                          <TaskLabelInlineList
                            labelIds={task.labelIds}
                            labelMap={taskLabelMap}
                            maxVisible={2}
                          />
                          <div className="flex items-center justify-between text-[11px] text-[#667085] dark:text-slate-400">
                            <PriorityLabel priority={task.priority} />
                            <span className="font-mono-num">{formatDateFR(task.dueAt)}</span>
                          </div>
                          <ProgressBar value={task.progress} overdue={overdue} />
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LabelManagerModal open={labelModalOpen} onClose={() => setLabelModalOpen(false)} />
    </div>
  );
}
