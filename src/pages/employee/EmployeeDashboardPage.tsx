import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, CalendarClock, CheckCircle2, Plus } from 'lucide-react';
import { TaskLabelInlineList } from '../../components/tasks/TaskLabels';
import {
  EmptyState,
  PriorityLabel,
  ProgressBar,
  StatCard,
  StatusLabel,
  TableSkeleton,
} from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  addDaysISO,
  formatDateFR,
  formatTimestampFR,
  getTodayDoualaISO,
  isTaskOverdue,
  isTaskScheduledForToday,
  timestampToDoualaISO,
} from '../../utils/dateUtils';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  task_created_published: 'Tâche créée et publiée',
  task_created_draft: 'Brouillon de tâche créé',
  task_published: 'Tâche publiée dans l’espace commun',
  task_updated: 'Tâche mise à jour',
  task_completed: 'Tâche clôturée',
  task_soft_deleted: 'Tâche archivée',
  label_created: 'Étiquette créée',
  label_updated: 'Étiquette modifiée',
  label_deleted: 'Étiquette supprimée',
  mission_created_and_assigned: 'Mission créée et attribuée',
  mission_assignment_accepted: 'Mission acceptée',
  mission_assignment_rejected: 'Mission refusée',
  mission_work_submitted: 'Travail soumis pour validation',
  mission_work_approved: 'Travail validé par le responsable',
  mission_changes_requested: 'Corrections demandées',
  report_generated: 'Rapport d’activité généré',
};

export function EmployeeDashboardPage() {
  const { profile } = useAuth();
  const { isDark } = useTheme();
  const { myTasks, myAssignments, auditLogs, taskLabelMap, dataReady } = useWorkspace();
  const navigate = useNavigate();
  const todayISO = getTodayDoualaISO();

  const stats = useMemo(() => {
    const active = myTasks.filter((t) => t.status !== 'cancelled');
    const todo = active.filter((t) => t.status === 'todo').length;
    const inProgress = active.filter(
      (t) =>
        t.status === 'in_progress' ||
        t.status === 'blocked' ||
        t.status === 'submitted' ||
        t.status === 'changes_requested'
    ).length;
    const completed = active.filter((t) => t.status === 'completed').length;
    const overdue = active.filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO)).length;
    const pendingMissions = myAssignments.filter((a) => a.acceptanceStatus === 'pending').length;

    return { total: active.length, todo, inProgress, completed, overdue, pendingMissions };
  }, [myTasks, myAssignments, todayISO]);

  const todayTasks = useMemo(() => {
    return myTasks
      .filter(
        (t) =>
          t.status !== 'completed' &&
          t.status !== 'cancelled' &&
          (isTaskScheduledForToday(t.plannedDate, t.dueAt, todayISO) ||
            isTaskOverdue(t.dueAt, t.status, todayISO))
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [myTasks, todayISO]);

  const upcomingTasks = useMemo(() => {
    return myTasks
      .filter(
        (t) =>
          t.status !== 'completed' &&
          t.status !== 'cancelled' &&
          t.dueAt &&
          t.dueAt.slice(0, 10) > todayISO
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 6);
  }, [myTasks, todayISO]);

  const statusChartData = useMemo(
    () => [
      { name: 'À faire', count: stats.todo, color: isDark ? '#94A3B8' : '#667085' },
      { name: 'En cours', count: stats.inProgress, color: isDark ? '#60A5FA' : '#3578C8' },
      { name: 'Terminées', count: stats.completed, color: isDark ? '#34D399' : '#16A36A' },
      { name: 'En retard', count: stats.overdue, color: isDark ? '#F87171' : '#DC4545' },
    ],
    [stats, isDark]
  );

  // Évolution hebdomadaire sur les 6 dernières semaines calculée sur les données Firestore réelles
  const weeklyTrendData = useMemo(() => {
    const weeks: Array<{ label: string; terminees: number; creees: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const endISO = addDaysISO(todayISO, -i * 7);
      const startISO = addDaysISO(endISO, -6);
      const creees = myTasks.filter((t) => {
        const c = timestampToDoualaISO(t.createdAt);
        return c !== null && c >= startISO && c <= endISO;
      }).length;
      const terminees = myTasks.filter((t) => {
        if (t.status !== 'completed') return false;
        const c = timestampToDoualaISO(t.completedAt) ?? timestampToDoualaISO(t.updatedAt);
        return c !== null && c >= startISO && c <= endISO;
      }).length;
      weeks.push({
        label: `S-${i === 0 ? 'act.' : i}`,
        terminees,
        creees,
      });
    }
    return weeks;
  }, [myTasks, todayISO]);

  const recentLogs = useMemo(() => auditLogs.slice(0, 8), [auditLogs]);

  const chartGridStroke = isDark ? '#1E293B' : '#E2E8F0';
  const chartTickColor = isDark ? '#94A3B8' : '#667085';
  const tooltipStyle = isDark
    ? {
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '8px',
        color: '#F1F5F9',
        fontSize: '12px',
      }
    : {
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        color: '#172D4D',
        fontSize: '12px',
      };

  if (!dataReady) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Bonjour, {profile?.firstName}
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-1">
            Synthèse en temps réel de vos activités · {formatDateFR(todayISO)} (Africa/Douala)
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/mes-missions"
            className="px-3.5 py-2 text-sm font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Mes missions ({stats.pendingMissions} en attente)
          </Link>
          <Link
            to="/taches/nouvelle"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[#3578C8] rounded-lg hover:bg-[#2a63a8] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Créer une tâche
          </Link>
        </div>
      </div>

      {/* 6 KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total de mes tâches" value={stats.total} onClick={() => navigate('/mes-taches')} />
        <StatCard label="À faire" value={stats.todo} onClick={() => navigate('/mes-taches?statut=todo')} />
        <StatCard
          label="En cours"
          value={stats.inProgress}
          tone="blue"
          onClick={() => navigate('/mes-taches?statut=in_progress')}
        />
        <StatCard
          label="Terminées"
          value={stats.completed}
          tone="green"
          onClick={() => navigate('/mes-taches?statut=completed')}
        />
        <StatCard
          label="En retard"
          value={stats.overdue}
          tone={stats.overdue > 0 ? 'red' : 'default'}
          onClick={() => navigate('/mes-taches?statut=overdue')}
        />
        <StatCard
          label="Missions en attente"
          value={stats.pendingMissions}
          tone={stats.pendingMissions > 0 ? 'amber' : 'default'}
          onClick={() => navigate('/mes-missions')}
        />
      </div>

      {/* Today's Tasks + Upcoming Deadlines */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-8 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">Mes tâches du jour</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                Tâches planifiées aujourd’hui, dues aujourd’hui ou en retard
              </p>
            </div>
            <Link
              to="/mes-taches"
              className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              Voir tout <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {todayTasks.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#16A36A] dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100">
                Aucune tâche urgente en attente pour aujourd’hui
              </p>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
                Planifiez une nouvelle activité ou consultez vos prochaines échéances.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayTasks.map((task) => {
                const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
                return (
                  <div
                    key={task.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/taches/${task.id}`}
                        className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                      >
                        {task.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[#667085] dark:text-slate-400">
                        <PriorityLabel priority={task.priority} />
                        <span aria-hidden="true">·</span>
                        <StatusLabel status={task.status} overdue={overdue} />
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">Échéance {formatDateFR(task.dueAt)}</span>
                      </div>
                      <TaskLabelInlineList
                        labelIds={task.labelIds}
                        labelMap={taskLabelMap}
                        maxVisible={3}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-32">
                        <ProgressBar value={task.progress} overdue={overdue} />
                      </div>
                      <Link
                        to={`/taches/${task.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-[#3578C8] hover:text-[#3578C8] dark:hover:border-blue-400 dark:hover:text-blue-400 whitespace-nowrap"
                      >
                        Ouvrir
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming Deadlines */}
        <section className="xl:col-span-4 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">
              Mes prochaines échéances
            </h2>
            <CalendarClock className="w-4 h-4 text-[#667085] dark:text-slate-400" />
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#667085] dark:text-slate-400">
              Aucune échéance future enregistrée pour le moment.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingTasks.map((task) => (
                <li key={task.id} className="px-5 py-3.5 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50">
                  <Link to={`/taches/${task.id}`} className="block">
                    <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100 truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1 text-xs text-[#667085] dark:text-slate-400">
                      <span className="font-mono-num">{formatDateFR(task.dueAt)}</span>
                      <PriorityLabel priority={task.priority} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5">
          <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100 mb-1">
            Évolution hebdomadaire
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mb-5">
            Tâches créées et clôturées sur les 6 dernières semaines
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartTickColor }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: chartTickColor }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="creees"
                  name="Créées"
                  stroke={isDark ? '#60A5FA' : '#3578C8'}
                  fill={isDark ? 'rgba(59, 130, 246, 0.2)' : '#EAF2FC'}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="terminees"
                  name="Terminées"
                  stroke={isDark ? '#34D399' : '#16A36A'}
                  fill={isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7'}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5">
          <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100 mb-1">
            Répartition par statut
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mb-5">
            État actuel de vos tâches enregistrées dans Firestore
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTickColor }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: chartTickColor }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Tâches" radius={[4, 4, 0, 0]}>
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Recent Activity */}
      <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80">
          <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">Activités récentes</h2>
        </div>
        {recentLogs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucune activité enregistrée"
              description="Vos créations de tâches, acceptations de missions et validations apparaîtront ici automatiquement."
              action={
                <Link
                  to="/taches/nouvelle"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3578C8] text-white rounded-lg hover:bg-[#2a63a8]"
                >
                  <Plus className="w-4 h-4" />
                  Créer ma première tâche
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLogs.map((log) => (
              <li
                key={log.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-[#172D4D] dark:text-slate-100">
                    {AUDIT_ACTION_LABELS[log.action] || log.action}
                  </span>
                  {typeof log.metadata?.title === 'string' && (
                    <span className="text-[#667085] dark:text-slate-400"> — {log.metadata.title}</span>
                  )}
                  {typeof log.metadata?.name === 'string' && (
                    <span className="text-[#667085] dark:text-slate-400"> — {log.metadata.name}</span>
                  )}
                </div>
                <span className="text-xs font-mono-num text-[#667085] dark:text-slate-400 shrink-0">
                  {formatTimestampFR(log.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
