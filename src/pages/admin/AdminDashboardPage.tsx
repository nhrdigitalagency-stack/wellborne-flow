import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Settings, Shield, Users } from 'lucide-react';
import { StatCard, TableSkeleton } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestampFR } from '../../utils/dateUtils';
import { ROLE_LABELS } from '../../utils/taskUtils';

export function AdminDashboardPage() {
  const { orgSettings } = useAuth();
  const { teamDirectory, publishedTasks, managedMissions, auditLogs, dataReady } = useWorkspace();
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const activeUsers = teamDirectory.filter((u) => u.accountStatus === 'active').length;
    const pendingUsers = teamDirectory.filter((u) => u.accountStatus === 'pending').length;
    const suspendedUsers = teamDirectory.filter((u) => u.accountStatus === 'suspended').length;
    const managersCount = teamDirectory.filter((u) => u.role === 'manager' || u.role === 'admin').length;
    return {
      totalUsers: teamDirectory.length,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      managersCount,
    };
  }, [teamDirectory]);

  const pendingAccounts = useMemo(
    () => teamDirectory.filter((u) => u.accountStatus === 'pending'),
    [teamDirectory]
  );

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Administration générale — {orgSettings.companyName}
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-1">
            Gouvernance des comptes, attribution des rôles, paramètres de sécurité et supervision globale.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/utilisateurs"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8]"
          >
            <Users className="w-4 h-4" />
            Gérer les utilisateurs
          </Link>
          <Link
            to="/admin/parametres"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 text-[#172D4D] dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Settings className="w-4 h-4" />
            Paramètres
          </Link>
        </div>
      </div>

      {/* Admin KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Comptes totaux"
          value={summary.totalUsers}
          helper={`${summary.managersCount} responsables/admins`}
          onClick={() => navigate('/admin/utilisateurs')}
        />
        <StatCard
          label="Comptes actifs"
          value={summary.activeUsers}
          tone="green"
          onClick={() => navigate('/admin/utilisateurs')}
        />
        <StatCard
          label="En attente d’activation"
          value={summary.pendingUsers}
          tone={summary.pendingUsers > 0 ? 'amber' : 'default'}
          onClick={() => navigate('/admin/utilisateurs')}
        />
        <StatCard
          label="Comptes suspendus"
          value={summary.suspendedUsers}
          tone={summary.suspendedUsers > 0 ? 'red' : 'default'}
          onClick={() => navigate('/admin/utilisateurs')}
        />
        <StatCard
          label="Tâches publiées"
          value={publishedTasks.length}
          tone="blue"
          onClick={() => navigate('/toutes-les-taches')}
        />
        <StatCard
          label="Missions publiées"
          value={managedMissions.length}
          onClick={() => navigate('/toutes-les-missions')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Accounts */}
        <section className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">
              Demandes d’activation en attente ({pendingAccounts.length})
            </h2>
            <Link
              to="/admin/utilisateurs"
              className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Gérer <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {pendingAccounts.length === 0 ? (
            <div className="p-6 text-xs text-[#667085] dark:text-slate-400">
              Aucun compte collaborateur n’est en attente de validation.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingAccounts.map((u) => (
                <li key={u.uid} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-[#667085] dark:text-slate-400">
                      {u.position || 'Collaborateur'} · {ROLE_LABELS[u.role]}
                    </p>
                  </div>
                  <Link
                    to="/admin/utilisateurs"
                    className="px-3 py-1.5 text-xs font-semibold bg-[#16A36A] hover:bg-[#138a59] text-white rounded-lg"
                  >
                    Examiner
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Configuration Summary */}
        <section className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
              <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">
                Politique active de l’entreprise
              </h2>
            </div>
            <Link to="/admin/parametres" className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline">
              Modifier
            </Link>
          </div>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-[#667085] dark:text-slate-400">Fuseau horaire de référence</dt>
              <dd className="font-mono-num font-medium text-[#172D4D] dark:text-slate-100">
                {orgSettings.timezone}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-[#667085] dark:text-slate-400">Rappel quotidien programmé</dt>
              <dd className="font-mono-num font-medium text-[#172D4D] dark:text-slate-100">
                Tous les jours à {orgSettings.reminderTime}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-[#667085] dark:text-slate-400">Rapport hebdomadaire automatique</dt>
              <dd className="font-mono-num font-medium text-[#172D4D] dark:text-slate-100">
                Chaque {orgSettings.weeklyReportDay === 'monday' ? 'lundi' : 'dimanche'} à{' '}
                {orgSettings.weeklyReportTime}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-[#667085] dark:text-slate-400">Activation manuelle des inscrits</dt>
              <dd className="font-medium text-[#172D4D] dark:text-slate-100">
                {orgSettings.requireAdminActivation ? 'Activée (recommandé)' : 'Automatique'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Latest Security Audit Events */}
      <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#172D4D] dark:text-slate-100">
            Dernières entrées du journal de sécurité
          </h2>
          <Link to="/admin/securite" className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline">
            Voir le journal complet
          </Link>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-6 text-xs text-[#667085] dark:text-slate-400">
            Aucune entrée enregistrée pour le moment.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.slice(0, 8).map((log) => (
              <li
                key={log.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#172D4D] dark:text-slate-100">{log.actorName}</span>
                  <span className="text-[#667085] dark:text-slate-400"> · {log.action} · </span>
                  <span className="font-mono-num text-[#667085] dark:text-slate-400">
                    {log.entityType}/{log.entityId.slice(0, 12)}
                  </span>
                </div>
                <span className="font-mono-num text-[#667085] dark:text-slate-400">
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
