import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  FileBarChart2,
  Flame,
  GripVertical,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import type { Mission, MissionAssignment, Task, TaskLabel } from '../../types';
import {
  CUSTOM_SHORTCUT_TARGETS,
  DASHBOARD_PRESETS,
  DashboardPresetId,
  DashboardWidgetId,
  DashboardWidgetPref,
  EMPLOYEE_WIDGET_CATALOG,
  EmployeeDashboardConfig,
  PrioritySummaryFilter,
  QUICK_SHORTCUT_CATALOG,
  WIDGET_CATALOG_MAP,
  isAllowedCustomShortcutRoute,
  moveWidgetByDelta,
  reorderWidgets,
  selectDailyPriorityTasks,
  setWidgetSpan,
  toggleWidgetVisibility,
} from '../../utils/dashboardWidgets';
import { formatDateFR, isTaskOverdue } from '../../utils/dateUtils';
import { ACCEPTANCE_LABELS, WORK_STATUS_LABELS } from '../../utils/taskUtils';
import { TaskLabelInlineList } from '../tasks/TaskLabels';
import { Modal, PriorityLabel, ProgressBar, StatusLabel } from '../ui/Primitives';

/* ============================================================================
 * 1. Widget : Résumé des tâches prioritaires du jour
 * ============================================================================ */

interface PrioritySummaryWidgetProps {
  tasks: Task[];
  todayISO: string;
  taskLabelMap: Map<string, TaskLabel>;
  maxItems: 3 | 5 | 8;
  busyTaskId: string | null;
  onQuickStart: (task: Task) => void;
  onQuickComplete: (task: Task) => void;
}

export function PrioritySummaryWidget({
  tasks,
  todayISO,
  taskLabelMap,
  maxItems,
  busyTaskId,
  onQuickStart,
  onQuickComplete,
}: PrioritySummaryWidgetProps) {
  const [filter, setFilter] = useState<PrioritySummaryFilter>('all');

  const summary = useMemo(
    () => selectDailyPriorityTasks(tasks, todayISO, filter, maxItems),
    [tasks, todayISO, filter, maxItems]
  );

  return (
    <section
      aria-labelledby="widget-priority-summary-title"
      className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden h-full flex flex-col"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            id="widget-priority-summary-title"
            className="text-base font-bold text-[#172D4D] dark:text-slate-100"
          >
            Résumé des tâches prioritaires du jour
          </h2>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-xs text-[#667085] dark:text-slate-400">
            <span className="font-mono-num">
              <strong
                className={
                  summary.overdueCount > 0
                    ? 'text-[#DC4545] dark:text-red-400'
                    : 'text-[#172D4D] dark:text-slate-200'
                }
              >
                {summary.overdueCount}
              </strong>{' '}
              en retard
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              <strong
                className={
                  summary.highUrgentTodayCount > 0
                    ? 'text-[#D97706] dark:text-amber-400'
                    : 'text-[#172D4D] dark:text-slate-200'
                }
              >
                {summary.highUrgentTodayCount}
              </strong>{' '}
              élevée/urgente du jour
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              <strong className="text-[#172D4D] dark:text-slate-200">{summary.dueTodayCount}</strong>{' '}
              échéance aujourd’hui
            </span>
          </div>
        </div>

        {/* Filtres segmentés */}
        <div
          role="group"
          aria-label="Filtrer les tâches prioritaires"
          className="inline-flex items-center p-0.5 bg-[#F4F6FA] dark:bg-[#0B1320] border border-slate-200 dark:border-slate-700/80 rounded-lg self-start sm:self-auto shrink-0"
        >
          {(
            [
              { id: 'all', label: 'Prioritaires' },
              { id: 'high_urgent', label: 'Urgentes' },
              { id: 'overdue', label: 'Retards' },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3578C8] ${
                  active
                    ? 'bg-white dark:bg-[#1E293B] text-[#172D4D] dark:text-slate-100 shadow-xs'
                    : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {summary.items.length === 0 ? (
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-[#16A36A] dark:text-emerald-400 mb-2" />
          <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100">
            {filter === 'overdue'
              ? 'Aucune tâche en retard'
              : filter === 'high_urgent'
              ? 'Aucune tâche élevée ou urgente active'
              : 'Aucune priorité critique en attente'}
          </p>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
            Vos priorités quotidiennes sont sous contrôle.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
          {summary.items.map((task) => {
            const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
            const isBusy = busyTaskId === task.id;
            const canQuickStart = task.status === 'todo';
            const canQuickComplete =
              task.source === 'personal' &&
              (task.status === 'in_progress' || task.status === 'todo');

            return (
              <div
                key={task.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/taches/${task.id}`}
                    className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                  >
                    {task.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[#667085] dark:text-slate-400">
                    <PriorityLabel priority={task.priority} />
                    <span aria-hidden="true">·</span>
                    <StatusLabel status={task.status} overdue={overdue} />
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">Échéance {formatDateFR(task.dueAt)}</span>
                  </div>
                  <TaskLabelInlineList
                    labelIds={task.labelIds}
                    labelMap={taskLabelMap}
                    maxVisible={2}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="w-24 hidden sm:block">
                    <ProgressBar value={task.progress} overdue={overdue} />
                  </div>
                  {canQuickStart && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onQuickStart(task)}
                      title="Passer la tâche en cours"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#3578C8] dark:text-blue-400 bg-[#EAF2FC] dark:bg-blue-950/50 rounded-md hover:bg-[#dce9fa] dark:hover:bg-blue-950 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      {isBusy ? '…' : 'Démarrer'}
                    </button>
                  )}
                  {!canQuickStart && canQuickComplete && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onQuickComplete(task)}
                      title="Clôturer cette tâche"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#16A36A] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      {isBusy ? '…' : 'Terminer'}
                    </button>
                  )}
                  <Link
                    to={`/taches/${task.id}`}
                    className="px-2.5 py-1.5 text-xs font-medium text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md hover:border-[#3578C8] hover:text-[#3578C8] dark:hover:border-blue-400 dark:hover:text-blue-400 whitespace-nowrap"
                  >
                    Ouvrir
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {summary.totalMatching > summary.items.length && (
        <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0D1626] flex items-center justify-between text-xs">
          <span className="text-[#667085] dark:text-slate-400 font-mono-num">
            {summary.items.length} affichées sur {summary.totalMatching}
          </span>
          <Link
            to={filter === 'overdue' ? '/mes-taches?statut=overdue' : '/mes-taches'}
            className="font-semibold text-[#3578C8] dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            Voir toute la liste <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}

/* ============================================================================
 * 2. Widget : Raccourcis rapides
 * ============================================================================ */

interface QuickShortcutsWidgetProps {
  enabledShortcutIds: string[];
  customShortcuts: EmployeeDashboardConfig['customShortcuts'];
  metrics: {
    overdue: number;
    urgent: number;
    pendingMissions: number;
    unreadNotifications: number;
    todayCount: number;
  };
  onOpenCustomize: () => void;
}

const SHORTCUT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create_task: Plus,
  overdue_tasks: AlertTriangle,
  urgent_tasks: Flame,
  my_missions: Briefcase,
  planning: Calendar,
  reports: FileBarChart2,
  shared_workspace: Users,
  notifications: Bell,
};

export function QuickShortcutsWidget({
  enabledShortcutIds,
  customShortcuts,
  metrics,
  onOpenCustomize,
}: QuickShortcutsWidgetProps) {
  const builtinItems = useMemo(
    () => QUICK_SHORTCUT_CATALOG.filter((s) => enabledShortcutIds.includes(s.id)),
    [enabledShortcutIds]
  );

  const totalCount = builtinItems.length + customShortcuts.length;

  return (
    <section
      aria-labelledby="widget-quick-shortcuts-title"
      className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden h-full flex flex-col"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
        <div>
          <h2
            id="widget-quick-shortcuts-title"
            className="text-base font-bold text-[#172D4D] dark:text-slate-100"
          >
            Raccourcis rapides
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Vos actions fréquentes en un clic
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCustomize}
          className="text-xs font-medium text-[#3578C8] dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
        >
          Modifier
        </button>
      </div>

      {totalCount === 0 ? (
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100">
            Aucun raccourci sélectionné
          </p>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1 mb-4">
            Épinglez vos vues quotidiennes pour gagner du temps.
          </p>
          <button
            type="button"
            onClick={onOpenCustomize}
            className="px-3.5 py-2 text-xs font-medium text-white bg-[#3578C8] rounded-lg hover:bg-[#2a63a8] cursor-pointer"
          >
            Configurer mes raccourcis
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-slate-200 dark:bg-slate-800 flex-1">
          {builtinItems.map((item) => {
            const Icon = SHORTCUT_ICONS[item.id] ?? ArrowRight;
            const count = item.metricKey ? metrics[item.metricKey] : undefined;
            const isAlertCount =
              (item.metricKey === 'overdue' || item.metricKey === 'urgent') &&
              typeof count === 'number' &&
              count > 0;

            return (
              <Link
                key={item.id}
                to={item.to}
                className="group bg-white dark:bg-[#111C2E] p-4 flex flex-col justify-between gap-2 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/70 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#3578C8]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isAlertCount
                        ? 'text-[#DC4545] dark:text-red-400'
                        : 'text-[#3578C8] dark:text-blue-400'
                    }`}
                  />
                  {typeof count === 'number' && (
                    <span
                      className={`text-xs font-bold font-mono-num ${
                        isAlertCount
                          ? 'text-[#DC4545] dark:text-red-400'
                          : 'text-[#667085] dark:text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 group-hover:text-[#3578C8] dark:group-hover:text-blue-400 truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-[#667085] dark:text-slate-400 truncate mt-0.5">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}

          {customShortcuts.map((sc) => (
            <Link
              key={sc.id}
              to={sc.to}
              className="group bg-white dark:bg-[#111C2E] p-4 flex flex-col justify-between gap-2 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/70 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#3578C8]"
            >
              <div className="flex items-center justify-between gap-2">
                <ArrowRight className="w-4 h-4 shrink-0 text-[#3578C8] dark:text-blue-400" />
                <span className="text-[11px] text-[#667085] dark:text-slate-400">Perso</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 group-hover:text-[#3578C8] dark:group-hover:text-blue-400 truncate">
                  {sc.label}
                </p>
                <p className="text-xs text-[#667085] dark:text-slate-400 truncate mt-0.5">
                  Raccourci enregistré
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================================================================
 * 3. Widget : Suivi de mes missions (optionnel / activable)
 * ============================================================================ */

interface PendingMissionsWidgetProps {
  assignments: MissionAssignment[];
  missions: Mission[];
}

export function PendingMissionsWidget({ assignments, missions }: PendingMissionsWidgetProps) {
  const missionMap = useMemo(() => new Map(missions.map((m) => [m.id, m])), [missions]);

  const activeAssignments = useMemo(() => {
    return assignments
      .filter((a) => a.acceptanceStatus !== 'rejected' && a.workStatus !== 'approved')
      .sort((a, b) => {
        // Priorité aux missions en attente de réponse puis corrections demandées
        const rank = (item: MissionAssignment) =>
          item.acceptanceStatus === 'pending'
            ? 0
            : item.workStatus === 'changes_requested'
            ? 1
            : 2;
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
        return (a.dueAt || '9999-12-31').localeCompare(b.dueAt || '9999-12-31');
      })
      .slice(0, 5);
  }, [assignments]);

  return (
    <section
      aria-labelledby="widget-pending-missions-title"
      className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden h-full flex flex-col"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
        <div>
          <h2
            id="widget-pending-missions-title"
            className="text-base font-bold text-[#172D4D] dark:text-slate-100"
          >
            Suivi de mes missions
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Affectations en attente de réponse ou en cours d’exécution
          </p>
        </div>
        <Link
          to="/mes-missions"
          className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
        >
          Tout voir <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {activeAssignments.length === 0 ? (
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <Briefcase className="w-7 h-7 text-[#667085] dark:text-slate-400 mb-2" />
          <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100">
            Aucune mission en attente
          </p>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
            Les missions qui vous sont attribuées s’afficheront ici automatiquement.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
          {activeAssignments.map((assignment) => {
            const mission = missionMap.get(assignment.missionId);
            const title = assignment.missionTitle || mission?.title || 'Mission attribuée';
            return (
              <li
                key={assignment.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to="/mes-missions"
                    className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                  >
                    {title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-[#667085] dark:text-slate-400">
                    <span
                      className={
                        assignment.acceptanceStatus === 'pending'
                          ? 'text-[#D97706] dark:text-amber-400 font-medium'
                          : assignment.workStatus === 'changes_requested'
                          ? 'text-[#DC4545] dark:text-red-400 font-medium'
                          : 'text-[#3578C8] dark:text-blue-400 font-medium'
                      }
                    >
                      {assignment.acceptanceStatus === 'pending'
                        ? ACCEPTANCE_LABELS[assignment.acceptanceStatus]
                        : WORK_STATUS_LABELS[assignment.workStatus]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">Échéance {formatDateFR(assignment.dueAt)}</span>
                  </div>
                </div>
                <div className="w-24 shrink-0 hidden sm:block">
                  <ProgressBar value={assignment.progress} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ============================================================================
 * 4. Modale : Personnalisation complète du tableau de bord
 * ============================================================================ */

interface DashboardCustomizeModalProps {
  open: boolean;
  config: EmployeeDashboardConfig;
  onChange: (next: EmployeeDashboardConfig) => void;
  onApplyPreset: (presetId: DashboardPresetId) => void;
  onReset: () => void;
  onClose: () => void;
}

export function DashboardCustomizeModal({
  open,
  config,
  onChange,
  onApplyPreset,
  onReset,
  onClose,
}: DashboardCustomizeModalProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customTarget, setCustomTarget] = useState<string>(CUSTOM_SHORTCUT_TARGETS[0].to);
  const [customError, setCustomError] = useState('');

  const visibleCount = config.widgets.filter((w) => w.visible).length;

  const handleToggleShortcut = (shortcutId: string) => {
    const exists = config.enabledShortcuts.includes(shortcutId);
    const enabledShortcuts = exists
      ? config.enabledShortcuts.filter((id) => id !== shortcutId)
      : [...config.enabledShortcuts, shortcutId];
    onChange({ ...config, enabledShortcuts });
  };

  const handleAddCustomShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedLabel = customLabel.trim();
    if (!cleanedLabel) {
      setCustomError('Indiquez un intitulé court pour le raccourci.');
      return;
    }
    if (!isAllowedCustomShortcutRoute(customTarget)) {
      setCustomError('Destination interne non autorisée.');
      return;
    }
    if (config.customShortcuts.length >= 4) {
      setCustomError('Vous pouvez enregistrer 4 raccourcis personnalisés maximum.');
      return;
    }
    setCustomError('');
    onChange({
      ...config,
      customShortcuts: [
        ...config.customShortcuts,
        {
          id: `custom_${Date.now()}`,
          label: cleanedLabel.slice(0, 36),
          to: customTarget,
        },
      ],
    });
    setCustomLabel('');
  };

  const handleRemoveCustomShortcut = (id: string) => {
    onChange({
      ...config,
      customShortcuts: config.customShortcuts.filter((sc) => sc.id !== id),
    });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    onChange({
      ...config,
      widgets: reorderWidgets(config.widgets, dragIndex, targetIndex),
    });
    setDragIndex(null);
  };

  return (
    <Modal
      open={open}
      title="Personnaliser mon tableau de bord"
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Préréglages rapides */}
        <div>
          <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-2">
            Dispositions prédéfinies
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DASHBOARD_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.id)}
                className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#0B1320] hover:border-[#3578C8] dark:hover:border-blue-400 transition-colors cursor-pointer"
              >
                <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100">
                  {preset.label}
                </p>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5 leading-snug">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Ordre, visibilité & largeur des widgets */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-200">
              Widgets affichés ({visibleCount} / {EMPLOYEE_WIDGET_CATALOG.length})
            </p>
            <span className="text-xs text-[#667085] dark:text-slate-400">
              Glissez-déposez ou utilisez les flèches pour réordonner
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-700/80 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {config.widgets.map((widget, index) => {
              const entry = WIDGET_CATALOG_MAP.get(widget.id);
              if (!entry) return null;
              const isDragging = dragIndex === index;

              return (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => setDragIndex(null)}
                  className={`px-3.5 py-3 flex items-center justify-between gap-3 bg-white dark:bg-[#111C2E] transition-colors ${
                    isDragging ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <GripVertical
                      className="w-4 h-4 text-[#94A3B8] dark:text-slate-500 shrink-0 cursor-grab"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100 truncate">
                        {entry.title}
                      </p>
                      <p className="text-xs text-[#667085] dark:text-slate-400 truncate">
                        {entry.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {entry.resizable && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...config,
                            widgets: setWidgetSpan(
                              config.widgets,
                              widget.id,
                              widget.span === 'full' ? 'compact' : 'full'
                            ),
                          })
                        }
                        title={
                          widget.span === 'full'
                            ? 'Passer en largeur compacte'
                            : 'Passer en pleine largeur'
                        }
                        aria-label={`Largeur du widget ${entry.title} : ${
                          widget.span === 'full' ? 'pleine largeur' : 'compact'
                        }`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#667085] dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:border-[#3578C8] hover:text-[#3578C8] dark:hover:border-blue-400 dark:hover:text-blue-400 cursor-pointer whitespace-nowrap"
                      >
                        {widget.span === 'full' ? (
                          <>
                            <Minimize2 className="w-3 h-3" />
                            Large
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3 h-3" />
                            Compact
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        onChange({
                          ...config,
                          widgets: moveWidgetByDelta(config.widgets, widget.id, -1),
                        })
                      }
                      aria-label={`Monter ${entry.title}`}
                      className="p-1.5 text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === config.widgets.length - 1}
                      onClick={() =>
                        onChange({
                          ...config,
                          widgets: moveWidgetByDelta(config.widgets, widget.id, 1),
                        })
                      }
                      aria-label={`Descendre ${entry.title}`}
                      className="p-1.5 text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={widget.visible}
                      aria-label={`Afficher ${entry.title}`}
                      onClick={() =>
                        onChange({
                          ...config,
                          widgets: toggleWidgetVisibility(config.widgets, widget.id),
                        })
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ml-1 focus-visible:outline-2 focus-visible:outline-[#3578C8] ${
                        widget.visible
                          ? 'bg-[#3578C8]'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          widget.visible ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Réglages du résumé prioritaire */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-200">
              Nombre de tâches dans le résumé prioritaire
            </p>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
              Choisissez la densité affichée dans votre bloc priorités du jour.
            </p>
          </div>
          <div className="inline-flex items-center p-0.5 bg-[#F4F6FA] dark:bg-[#0B1320] border border-slate-200 dark:border-slate-700 rounded-lg self-start">
            {([3, 5, 8] as const).map((limit) => (
              <button
                key={limit}
                type="button"
                aria-pressed={config.prioritySummaryLimit === limit}
                onClick={() => onChange({ ...config, prioritySummaryLimit: limit })}
                className={`px-3 py-1 text-xs font-mono-num font-medium rounded-md transition-colors cursor-pointer ${
                  config.prioritySummaryLimit === limit
                    ? 'bg-white dark:bg-[#1E293B] text-[#172D4D] dark:text-slate-100 shadow-xs'
                    : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-200'
                }`}
              >
                {limit} tâches
              </button>
            ))}
          </div>
        </div>

        {/* Raccourcis rapides configurables */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-3">
          <div>
            <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-200">
              Raccourcis rapides épinglés
            </p>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
              Activez les accès directs utiles à votre routine quotidienne.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_SHORTCUT_CATALOG.map((shortcut) => {
              const checked = config.enabledShortcuts.includes(shortcut.id);
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => handleToggleShortcut(shortcut.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    checked
                      ? 'border-[#3578C8] bg-[#EAF2FC] dark:bg-blue-950/50 text-[#172D4D] dark:text-blue-200'
                      : 'border-slate-200 dark:border-slate-700 text-[#667085] dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="block truncate">{shortcut.label}</span>
                </button>
              );
            })}
          </div>

          {/* Raccourcis personnalisés vers filtres internes */}
          <form onSubmit={handleAddCustomShortcut} className="pt-2 space-y-2">
            <p className="text-xs font-medium text-[#172D4D] dark:text-slate-200">
              Ajouter un raccourci personnalisé ({config.customShortcuts.length}/4)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                maxLength={36}
                placeholder="Ex. Mes blocages"
                aria-label="Intitulé du raccourci personnalisé"
                className="sm:col-span-5 px-3 py-2 text-xs bg-white dark:bg-[#0B1320] text-[#172D4D] dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3578C8]"
              />
              <select
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                aria-label="Page de destination du raccourci"
                className="sm:col-span-5 px-3 py-2 text-xs bg-white dark:bg-[#0B1320] text-[#172D4D] dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3578C8]"
              >
                {CUSTOM_SHORTCUT_TARGETS.map((target) => (
                  <option key={target.to} value={target.to}>
                    {target.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={config.customShortcuts.length >= 4}
                className="sm:col-span-2 px-3 py-2 text-xs font-medium text-white bg-[#3578C8] rounded-lg hover:bg-[#2a63a8] disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Ajouter
              </button>
            </div>
            {customError && (
              <p className="text-xs text-[#DC4545] dark:text-red-400">{customError}</p>
            )}
          </form>

          {config.customShortcuts.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg">
              {config.customShortcuts.map((sc) => (
                <li
                  key={sc.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-medium text-[#172D4D] dark:text-slate-100 truncate">
                    {sc.label}{' '}
                    <span className="text-[#667085] dark:text-slate-400 font-normal">
                      ({CUSTOM_SHORTCUT_TARGETS.find((t) => t.to === sc.to)?.label ?? sc.to})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomShortcut(sc.id)}
                    aria-label={`Supprimer le raccourci ${sc.label}`}
                    className="p-1 text-[#667085] dark:text-slate-400 hover:text-[#DC4545] dark:hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#667085] dark:text-slate-300 hover:text-[#172D4D] dark:hover:text-slate-100 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser par défaut
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#3578C8] rounded-lg hover:bg-[#2a63a8] cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Terminer
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function WidgetEditHeaderBar({
  widget,
  index,
  totalVisible,
  onMoveUp,
  onMoveDown,
  onToggleSpan,
  onHide,
}: {
  widget: DashboardWidgetPref;
  index: number;
  totalVisible: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSpan: () => void;
  onHide: () => void;
}) {
  const entry = WIDGET_CATALOG_MAP.get(widget.id);
  if (!entry) return null;

  return (
    <div className="mb-1.5 px-3 py-1.5 bg-[#EAF2FC] dark:bg-[#17253B] border border-[#3578C8]/25 dark:border-blue-400/25 rounded-md flex items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-[#172D4D] dark:text-slate-100 truncate">
        {entry.title}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {entry.resizable && (
          <button
            type="button"
            onClick={onToggleSpan}
            className="px-2 py-0.5 text-[11px] font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded hover:border-[#3578C8] cursor-pointer whitespace-nowrap"
          >
            {widget.span === 'full' ? 'Compact' : 'Pleine largeur'}
          </button>
        )}
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label={`Monter ${entry.title}`}
          className="p-1 text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded disabled:opacity-35 cursor-pointer"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          disabled={index === totalVisible - 1}
          onClick={onMoveDown}
          aria-label={`Descendre ${entry.title}`}
          className="p-1 text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded disabled:opacity-35 cursor-pointer"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onHide}
          className="px-2 py-0.5 text-[11px] font-medium text-[#DC4545] dark:text-red-400 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded hover:border-[#DC4545] cursor-pointer whitespace-nowrap"
        >
          Masquer
        </button>
      </div>
    </div>
  );
}
