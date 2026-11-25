import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, PriorityLabel, StatusLabel, TableSkeleton } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { updatePersonalTaskDetails } from '../../services/tasks/taskService';
import type { Task } from '../../types';
import {
  addDaysISO,
  formatDateFR,
  getMonthGridISO,
  getTodayDoualaISO,
  getWeekDatesISO,
  isTaskOverdue,
} from '../../utils/dateUtils';

type CalView = 'day' | 'week' | 'month' | 'list';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getTaskToneClass(task: Task, todayISO: string): string {
  if (task.status === 'completed') {
    return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-[#16A36A] dark:text-emerald-400';
  }
  if (isTaskOverdue(task.dueAt, task.status, todayISO)) {
    return 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/70 text-[#DC4545] dark:text-red-400';
  }
  if (task.priority === 'urgent') {
    return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-[#D97706] dark:text-amber-400';
  }
  if (task.status === 'in_progress' || task.status === 'submitted') {
    return 'bg-[#EAF2FC] dark:bg-[#172A45] border-[#3578C8]/30 dark:border-blue-500/40 text-[#172D4D] dark:text-blue-200';
  }
  return 'bg-[#F4F6FA] dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-[#172D4D] dark:text-slate-200';
}

export function CalendarPage({ teamMode = false }: { teamMode?: boolean }) {
  const { profile } = useAuth();
  const { myTasks, publishedTasks, teamDirectory, dataReady } = useWorkspace();
  const { showToast } = useToast();

  const todayISO = getTodayDoualaISO();
  const [view, setView] = useState<CalView>('month');
  const [anchorISO, setAnchorISO] = useState(todayISO);
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const sourceTasks = useMemo(() => {
    if (!teamMode) return myTasks;
    const map = new Map<string, Task>();
    publishedTasks.forEach((t) => map.set(t.id, t));
    myTasks.forEach((t) => map.set(t.id, t));
    return Array.from(map.values()).filter((t) =>
      employeeFilter === 'all' ? true : t.ownerId === employeeFilter
    );
  }, [teamMode, myTasks, publishedTasks, employeeFilter]);

  const [anchorYear, anchorMonth] = useMemo(() => {
    const [y, m] = anchorISO.split('-').map(Number);
    return [y, m - 1];
  }, [anchorISO]);

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(anchorYear, anchorMonth, 15));
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Douala',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }, [anchorYear, anchorMonth]);

  const shiftPeriod = (dir: -1 | 1) => {
    if (view === 'day') {
      setAnchorISO(addDaysISO(anchorISO, dir));
    } else if (view === 'week') {
      setAnchorISO(addDaysISO(anchorISO, dir * 7));
    } else {
      const next = new Date(Date.UTC(anchorYear, anchorMonth + dir, 1));
      setAnchorISO(next.toISOString().slice(0, 10));
    }
  };

  const tasksForDate = (dateISO: string) =>
    sourceTasks.filter(
      (t) =>
        t.status !== 'cancelled' &&
        (t.plannedDate?.slice(0, 10) === dateISO || t.dueAt?.slice(0, 10) === dateISO)
    );

  const handleReschedule = async (task: Task, newPlannedDate: string) => {
    if (!profile || !newPlannedDate) return;
    if (task.ownerId !== profile.uid && profile.role !== 'admin') {
      showToast('Vous n’êtes pas autorisé à déplacer la tâche d’un collègue.', 'error');
      return;
    }
    try {
      await updatePersonalTaskDetails(profile, task, { plannedDate: newPlannedDate });
      showToast(`Tâche replanifiée au ${formatDateFR(newPlannedDate)}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur replanification', 'error');
    }
  };

  if (!dataReady) return <TableSkeleton rows={6} />;

  const weekDates = getWeekDatesISO(anchorISO);
  const monthCells = getMonthGridISO(anchorYear, anchorMonth);
  const chronologicalTasks = [...sourceTasks]
    .filter((t) => t.status !== 'cancelled')
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            {teamMode ? 'Planning collectif de l’équipe' : 'Mon planning'}
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Dates affichées sur le fuseau horaire Africa/Douala · Aujourd’hui :{' '}
            <span className="font-mono-num">{formatDateFR(todayISO)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {teamMode && (
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              aria-label="Filtrer le planning par collaborateur"
              className="px-3 py-2 text-xs font-medium bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            >
              <option value="all">Toute l’équipe</option>
              {teamDirectory.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          )}

          <div className="inline-flex items-center bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-1">
            {(
              [
                { id: 'day', label: 'Jour' },
                { id: 'week', label: 'Semaine' },
                { id: 'month', label: 'Mois' },
                { id: 'list', label: 'Liste' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  view === tab.id
                    ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                    : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Bar & Legend */}
      {view !== 'list' && (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              aria-label="Période précédente"
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-[#172D4D] dark:text-slate-200" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorISO(todayISO)}
              className="px-3 py-1.5 text-xs font-semibold text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              aria-label="Période suivante"
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-[#172D4D] dark:text-slate-200" />
            </button>
            <span className="ml-2 text-sm font-bold text-[#172D4D] dark:text-slate-100 capitalize">
              {view === 'day' ? formatDateFR(anchorISO) : monthLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#667085] dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EAF2FC] dark:bg-[#172A45] border border-[#3578C8]/40 dark:border-blue-500/50" /> En cours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700" /> Terminée
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700" /> Urgente
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-700" /> En retard
            </span>
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A]">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-2.5 px-2 text-center text-xs font-semibold text-[#667085] dark:text-slate-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {monthCells.map((cell) => {
              const items = tasksForDate(cell.dateISO);
              const isToday = cell.dateISO === todayISO;
              return (
                <div
                  key={cell.dateISO}
                  className={`min-h-[96px] sm:min-h-[112px] p-1.5 sm:p-2 ${
                    cell.inMonth
                      ? 'bg-white dark:bg-[#111C2E]'
                      : 'bg-[#F4F6FA]/50 dark:bg-[#0B1320]/60 text-slate-400 dark:text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono-num px-1.5 py-0.5 rounded ${
                        isToday
                          ? 'bg-[#3578C8] text-white font-bold'
                          : cell.inMonth
                          ? 'text-[#172D4D] dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {Number(cell.dateISO.slice(8, 10))}
                    </span>
                    {items.length > 0 && (
                      <span className="text-[10px] font-mono-num text-[#667085] dark:text-slate-400">
                        {items.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((t) => (
                      <Link
                        key={t.id}
                        to={`/taches/${t.id}`}
                        className={`block text-[11px] px-1.5 py-1 rounded border truncate ${getTaskToneClass(
                          t,
                          todayISO
                        )}`}
                        title={`${t.title} — ${t.ownerName}`}
                      >
                        {t.title}
                      </Link>
                    ))}
                    {items.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAnchorISO(cell.dateISO);
                          setView('day');
                        }}
                        className="text-[10px] font-semibold text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        +{items.length - 3} autres
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDates.map((dateISO, i) => {
            const items = tasksForDate(dateISO);
            const isToday = dateISO === todayISO;
            return (
              <div
                key={dateISO}
                className={`bg-white dark:bg-[#111C2E] border rounded-lg p-3 flex flex-col min-h-[220px] ${
                  isToday ? 'border-[#3578C8] dark:border-blue-400' : 'border-slate-200 dark:border-slate-700/80'
                }`}
              >
                <div className="pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                    {WEEKDAY_LABELS[i]}
                  </span>
                  <span
                    className={`text-xs font-mono-num ${
                      isToday
                        ? 'text-[#3578C8] dark:text-blue-400 font-bold'
                        : 'text-[#667085] dark:text-slate-400'
                    }`}
                  >
                    {dateISO.slice(8, 10)}/{dateISO.slice(5, 7)}
                  </span>
                </div>
                <div className="space-y-2 flex-1">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 py-4 text-center">Libre</p>
                  ) : (
                    items.map((t) => (
                      <Link
                        key={t.id}
                        to={`/taches/${t.id}`}
                        className={`block p-2 rounded-md border text-xs ${getTaskToneClass(t, todayISO)}`}
                      >
                        <p className="font-semibold line-clamp-2">{t.title}</p>
                        {teamMode && (
                          <p className="text-[10px] opacity-80 mt-0.5 truncate">{t.ownerName}</p>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAY VIEW */}
      {view === 'day' && (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
            <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
              Activités du {formatDateFR(anchorISO)}
            </h2>
          </div>
          {tasksForDate(anchorISO).length === 0 ? (
            <div className="p-8 text-center text-sm text-[#667085] dark:text-slate-400">
              Aucune tâche planifiée ou à échéance pour cette date.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasksForDate(anchorISO).map((task) => {
                const canMove = task.ownerId === profile?.uid || profile?.role === 'admin';
                const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
                return (
                  <div
                    key={task.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/taches/${task.id}`}
                        className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400"
                      >
                        {task.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mt-1">
                        <span>{task.ownerName}</span>
                        <span aria-hidden="true">·</span>
                        <PriorityLabel priority={task.priority} />
                        <span aria-hidden="true">·</span>
                        <StatusLabel status={task.status} overdue={overdue} />
                      </div>
                    </div>
                    {canMove && task.status !== 'completed' && (
                      <label className="inline-flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400 shrink-0">
                        <span>Déplacer au</span>
                        <input
                          type="date"
                          value={task.plannedDate}
                          onChange={(e) => handleReschedule(task, e.target.value)}
                          className="px-2 py-1 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-md font-mono-num text-[#172D4D] dark:text-slate-100"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CHRONOLOGICAL LIST VIEW */}
      {view === 'list' &&
        (chronologicalTasks.length === 0 ? (
          <EmptyState
            title="Planning vide"
            description="Créez des tâches ou acceptez vos missions pour alimenter votre calendrier."
          />
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
            {chronologicalTasks.map((task) => {
              const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
              const canMove = task.ownerId === profile?.uid || profile?.role === 'admin';
              return (
                <div
                  key={task.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/taches/${task.id}`}
                      className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                    >
                      {task.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                      <span className="font-mono-num">Échéance : {formatDateFR(task.dueAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.ownerName}</span>
                      <span aria-hidden="true">·</span>
                      <StatusLabel status={task.status} overdue={overdue} />
                    </div>
                  </div>
                  {canMove && task.status !== 'completed' && (
                    <label className="inline-flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400 shrink-0">
                      <span>Planifiée :</span>
                      <input
                        type="date"
                        value={task.plannedDate}
                        onChange={(e) => handleReschedule(task, e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-md font-mono-num text-[#172D4D] dark:text-slate-100"
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
