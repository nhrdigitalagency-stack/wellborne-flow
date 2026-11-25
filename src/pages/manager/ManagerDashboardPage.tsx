import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Plus } from 'lucide-react';
import {
  PriorityLabel,
  ProgressBar,
  StatCard,
  StatusLabel,
  TableSkeleton,
} from '../../components/ui/Primitives';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatDateFR, getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';

export function ManagerDashboardPage() {
  const { isDark } = useTheme();
  const {
    publishedTasks,
    managedMissions,
    managedAssignments,
    teamDirectory,
    dataReady,
  } = useWorkspace();
  const navigate = useNavigate();
  const todayISO = getTodayDoualaISO();

  const metrics = useMemo(() => {
    const activeTasks = publishedTasks.filter((t) => t.status !== 'cancelled');
    const completed = activeTasks.filter((t) => t.status === 'completed').length;
    const overdue = activeTasks.filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO)).length;
    const pendingValidations = managedAssignments.filter((a) => a.workStatus === 'submitted').length;
    const pendingResponses = managedAssignments.filter((a) => a.acceptanceStatus === 'pending').length;
    const activeMembers = teamDirectory.filter((u) => u.accountStatus === 'active').length;

    return {
      totalTasks: activeTasks.length,
      completed,
      overdue,
      missionsCount: managedMissions.length,
      pendingValidations,
      pendingResponses,
      activeMembers,
    };
  }, [publishedTasks, managedMissions, managedAssignments, teamDirectory, todayISO]);

  const workloadChartData = useMemo(() => {
    return teamDirectory
      .filter((u) => u.accountStatus === 'active')
      .map((u) => {
        const empTasks = publishedTasks.filter((t) => t.ownerId === u.uid && t.status !== 'cancelled');
        const active = empTasks.filter((t) => t.status !== 'completed').length;
        const done = empTasks.filter((t) => t.status === 'completed').length;
        return {
          name: `${u.firstName} ${u.lastName.charAt(0)}.`,
          actives: active,
          terminees: done,
        };
      });
  }, [teamDirectory, publishedTasks]);

  const submissionsQueue = useMemo(
    () => managedAssignments.filter((a) => a.workStatus === 'submitted').slice(0, 5),
    [managedAssignments]
  );

  const overdueTasks = useMemo(
    () =>
      publishedTasks
        .filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, 6),
    [publishedTasks, todayISO]
  );

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

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Supervision de l’entreprise
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-1">
            Pilotage centralisé des tâches publiées, missions multi-employés et validations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/validations"
            className="px-3.5 py-2 text-sm font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Validations ({metrics.pendingValidations})
          </Link>
          <Link
            to="/missions/nouvelle"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#3578C8] hover:bg-[#2a63a8] rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Attribuer une mission
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Tâches publiées"
          value={metrics.totalTasks}
          onClick={() => navigate('/toutes-les-taches')}
        />
        <StatCard
          label="Terminées"
          value={metrics.completed}
          tone="green"
          onClick={() => navigate('/toutes-les-taches')}
        />
        <StatCard
          label="Tâches en retard"
          value={metrics.overdue}
          tone={metrics.overdue > 0 ? 'red' : 'default'}
          onClick={() => navigate('/toutes-les-taches')}
        />
        <StatCard
          label="Missions créées"
          value={metrics.missionsCount}
          tone="blue"
          onClick={() => navigate('/toutes-les-missions')}
        />
        <StatCard
          label="À valider"
          value={metrics.pendingValidations}
          tone={metrics.pendingValidations > 0 ? 'amber' : 'default'}
          onClick={() => navigate('/validations')}
        />
        <StatCard
          label="Collaborateurs actifs"
          value={metrics.activeMembers}
          helper={`${metrics.pendingResponses} réponses mission`}
          onClick={() => navigate('/employes')}
        />
      </div>

      {/* Workload Chart + Pending Validations */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5">
          <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100 mb-1">
            Charge et réalisations par collaborateur
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mb-5">
            Tâches publiées actives vs clôturées sur Firestore
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadChartData} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTickColor }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: chartTickColor }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="actives"
                  name="Actives"
                  fill={isDark ? '#60A5FA' : '#3578C8'}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="terminees"
                  name="Terminées"
                  fill={isDark ? '#34D399' : '#16A36A'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="xl:col-span-5 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">Soumissions à valider</h2>
            <Link
              to="/validations"
              className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Centre de validation <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {submissionsQueue.length === 0 ? (
            <div className="p-6 text-xs text-[#667085] dark:text-slate-400 text-center">
              Aucun travail en attente de validation pour le moment.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {submissionsQueue.map((a) => (
                <li key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 truncate">
                      {a.missionTitle}
                    </p>
                    <p className="text-xs text-[#667085] dark:text-slate-400">
                      {a.employeeName} · Échéance {formatDateFR(a.dueAt)}
                    </p>
                  </div>
                  <Link
                    to="/validations"
                    className="px-3 py-1.5 text-xs font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] shrink-0"
                  >
                    Examiner
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Overdue Alert Table */}
      <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">
              Points de vigilance — Tâches en retard
            </h2>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
              Calculées automatiquement selon la date limite (fuseau Africa/Douala)
            </p>
          </div>
          <Link to="/rapports" className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline">
            Voir les rapports
          </Link>
        </div>

        {overdueTasks.length === 0 ? (
          <div className="p-6 text-xs text-[#16A36A] dark:text-emerald-400 font-medium">
            Aucune tâche publiée n’est actuellement en retard.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {overdueTasks.map((t) => (
              <div
                key={t.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <Link
                    to={`/taches/${t.id}`}
                    className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:text-[#3578C8] dark:hover:text-blue-400 block truncate"
                  >
                    {t.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    <span>{t.ownerName}</span>
                    <span aria-hidden="true">·</span>
                    <PriorityLabel priority={t.priority} />
                    <span aria-hidden="true">·</span>
                    <StatusLabel status={t.status} overdue />
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-mono-num font-semibold text-[#DC4545] dark:text-red-400">
                    Échéance {formatDateFR(t.dueAt)}
                  </span>
                  <div className="w-28">
                    <ProgressBar value={t.progress} overdue />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
