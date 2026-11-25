import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState, TableSkeleton } from '../../components/ui/Primitives';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatTimestampFR } from '../../utils/dateUtils';

export function AuditLogsPage() {
  const { auditLogs, dataReady } = useWorkspace();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (entityFilter !== 'all' && log.entityType !== entityFilter) return false;
      if (
        q &&
        !log.actorName.toLowerCase().includes(q) &&
        !log.action.toLowerCase().includes(q) &&
        !log.entityId.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [auditLogs, search, entityFilter]);

  if (!dataReady) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Journal d’activité et de sécurité
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Enregistrements immuables dans Firestore (<code className="font-mono-num">auditLogs</code>) — modification et suppression bloquées par les règles de sécurité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#667085] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par acteur ou action…"
              className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            aria-label="Filtrer par type d’entité"
            className="px-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
          >
            <option value="all">Toutes entités</option>
            <option value="task">Tâches</option>
            <option value="label">Étiquettes</option>
            <option value="mission">Missions</option>
            <option value="assignment">Affectations</option>
            <option value="user">Utilisateurs</option>
            <option value="report">Rapports</option>
            <option value="settings">Paramètres</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun événement trouvé"
          description="Les opérations sensibles (créations, validations, changements de rôle, suppressions logiques) sont tracées automatiquement."
        />
      ) : (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs font-semibold text-[#667085] dark:text-slate-400">
                  <th className="py-3 px-4">Date (Africa/Douala)</th>
                  <th className="py-3 px-4">Acteur</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entité</th>
                  <th className="py-3 px-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4 text-xs font-mono-num text-[#667085] dark:text-slate-400 whitespace-nowrap">
                      {formatTimestampFR(log.timestamp)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-[#172D4D] dark:text-slate-100 whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-num text-[#3578C8] dark:text-blue-400 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-num text-[#172D4D] dark:text-slate-200 whitespace-nowrap">
                      {log.entityType} · {log.entityId.slice(0, 14)}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#667085] dark:text-slate-400 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
