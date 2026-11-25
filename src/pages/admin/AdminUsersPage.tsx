import React, { useMemo, useState } from 'react';
import { Check, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { TableSkeleton, UserAvatar } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { adminUpdateUserAccess } from '../../services/auth/authService';
import type { AccountStatus, UserPublic, UserRole } from '../../types';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../../utils/taskUtils';

export function AdminUsersPage() {
  const { profile } = useAuth();
  const { teamDirectory, dataReady } = useWorkspace();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamDirectory.filter((u) => {
      if (statusFilter !== 'all' && u.accountStatus !== statusFilter) return false;
      if (
        q &&
        !`${u.firstName} ${u.lastName}`.toLowerCase().includes(q) &&
        !(u.position || '').toLowerCase().includes(q) &&
        !(u.department || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [teamDirectory, search, statusFilter]);

  const handleUpdate = async (
    target: UserPublic,
    nextRole: UserRole,
    nextStatus: AccountStatus
  ) => {
    if (!profile) return;
    if (target.uid === profile.uid && (nextRole !== 'admin' || nextStatus !== 'active')) {
      showToast(
        'Par sécurité, vous ne pouvez pas retirer vos propres droits administrateur ni suspendre votre propre compte.',
        'error'
      );
      return;
    }

    setBusyUid(target.uid);
    try {
      await adminUpdateUserAccess(
        profile,
        target.uid,
        {
          role: nextRole,
          accountStatus: nextStatus,
        },
        target.accountStatus
      );
      showToast(
        `Droits mis à jour pour ${target.firstName} ${target.lastName} (${ROLE_LABELS[nextRole]} · ${ACCOUNT_STATUS_LABELS[nextStatus]}).`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour compte', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Gestion des utilisateurs et des rôles
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Activez les nouveaux comptes inscrits, nommez les responsables ou suspendez un accès instantanément.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#667085] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | AccountStatus)}
            aria-label="Filtrer par statut de compte"
            className="px-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="active">Actifs</option>
            <option value="suspended">Suspendus</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs font-semibold text-[#667085] dark:text-slate-400">
                <th className="py-3 px-4">Collaborateur</th>
                <th className="py-3 px-4">Poste / Département</th>
                <th className="py-3 px-4">Statut du compte</th>
                <th className="py-3 px-4">Rôle attribué</th>
                <th className="py-3 px-4 text-right">Actions rapides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((u) => {
                const isSelf = u.uid === profile?.uid;
                const isBusy = busyUid === u.uid;
                return (
                  <tr key={u.uid} className="hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          firstName={u.firstName}
                          lastName={u.lastName}
                          photoURL={u.photoURL}
                          size="sm"
                        />
                        <div>
                          <p className="font-semibold text-[#172D4D] dark:text-slate-100">
                            {u.firstName} {u.lastName}
                            {isSelf && (
                              <span className="text-xs font-normal text-[#3578C8] dark:text-blue-400">
                                {' '}
                                (Vous)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
                            {u.uid.slice(0, 12)}…
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#667085] dark:text-slate-400">
                      {u.position || '—'}
                      {u.department ? ` · ${u.department}` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          u.accountStatus === 'active'
                            ? 'text-[#16A36A] dark:text-emerald-400'
                            : u.accountStatus === 'suspended'
                            ? 'text-[#DC4545] dark:text-red-400'
                            : 'text-[#D97706] dark:text-amber-400'
                        }
                      >
                        {ACCOUNT_STATUS_LABELS[u.accountStatus]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        disabled={isSelf || isBusy}
                        onChange={(e) =>
                          handleUpdate(u, e.target.value as UserRole, u.accountStatus)
                        }
                        aria-label={`Rôle de ${u.firstName} ${u.lastName}`}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100 disabled:opacity-50"
                      >
                        <option value="employee">Employé</option>
                        <option value="manager">Responsable</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {!isSelf && (
                        <div className="inline-flex items-center gap-2">
                          {u.accountStatus !== 'active' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdate(u, u.role, 'active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#16A36A] text-white rounded-lg hover:bg-[#138a59] cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Activer
                            </button>
                          )}
                          {u.accountStatus !== 'suspended' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdate(u, u.role, 'suspended')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-[#0F172A] border border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Suspendre
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdate(u, u.role, 'active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#3578C8] text-white rounded-lg hover:bg-[#2a63a8] cursor-pointer disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Réactiver
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
