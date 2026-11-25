import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { TableSkeleton, UserAvatar } from '../../components/ui/Primitives';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../../utils/taskUtils';

export function EmployeesDirectoryPage() {
  const { teamDirectory, publishedTasks, managedAssignments, dataReady } = useWorkspace();
  const [search, setSearch] = useState('');
  const todayISO = getTodayDoualaISO();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamDirectory
      .filter((u) => {
        if (!q) return true;
        return (
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          (u.position || '').toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q)
        );
      })
      .map((u) => {
        const empTasks = publishedTasks.filter((t) => t.ownerId === u.uid && t.status !== 'cancelled');
        const completed = empTasks.filter((t) => t.status === 'completed').length;
        const active = empTasks.filter((t) => t.status !== 'completed').length;
        const overdue = empTasks.filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO)).length;
        const missionsCount = managedAssignments.filter((a) => a.employeeId === u.uid).length;
        return { user: u, total: empTasks.length, active, completed, overdue, missionsCount };
      });
  }, [teamDirectory, publishedTasks, managedAssignments, search, todayISO]);

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Annuaire et suivi des employés
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            {rows.length} collaborateur{rows.length > 1 ? 's' : ''} enregistré{rows.length > 1 ? 's' : ''} · Charge calculée sur les tâches publiées
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#667085] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un collaborateur…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs font-semibold text-[#667085] dark:text-slate-400">
                <th className="py-3 px-4">Collaborateur</th>
                <th className="py-3 px-4">Poste / Département</th>
                <th className="py-3 px-4">Rôle & Statut</th>
                <th className="py-3 px-4 text-right">Actives</th>
                <th className="py-3 px-4 text-right">Terminées</th>
                <th className="py-3 px-4 text-right">En retard</th>
                <th className="py-3 px-4 text-right">Missions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ user, active, completed, overdue, missionsCount }) => (
                <tr key={user.uid} className="hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        firstName={user.firstName}
                        lastName={user.lastName}
                        photoURL={user.photoURL}
                        size="sm"
                      />
                      <span className="font-semibold text-[#172D4D] dark:text-slate-100">
                        {user.firstName} {user.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#667085] dark:text-slate-400">
                    {user.position || '—'}
                    {user.department ? ` · ${user.department}` : ''}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="font-medium text-[#172D4D] dark:text-slate-200">
                      {ROLE_LABELS[user.role]}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600 mx-1.5">·</span>
                    <span
                      className={
                        user.accountStatus === 'active'
                          ? 'text-[#16A36A] dark:text-emerald-400'
                          : user.accountStatus === 'suspended'
                          ? 'text-[#DC4545] dark:text-red-400 font-semibold'
                          : 'text-[#D97706] dark:text-amber-400 font-semibold'
                      }
                    >
                      {ACCOUNT_STATUS_LABELS[user.accountStatus]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-[#3578C8] dark:text-blue-400 font-medium">
                    {active}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-[#16A36A] dark:text-emerald-400 font-medium">
                    {completed}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-[#DC4545] dark:text-red-400 font-semibold">
                    {overdue}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-[#172D4D] dark:text-slate-200">
                    {missionsCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
