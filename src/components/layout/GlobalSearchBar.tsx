import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckSquare, Search, Target, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatDateFR, getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';
import { searchWorkspaceItems } from '../../utils/searchUtils';
import { TaskLabelInlineList } from '../tasks/TaskLabels';
import { PriorityLabel, StatusLabel } from '../ui/Primitives';

interface NavigableItem {
  key: string;
  route: string;
  keepQuery: boolean;
}

export function GlobalSearchBar() {
  const { profile } = useAuth();
  const {
    myTasks,
    publishedTasks,
    taskLabels,
    taskLabelMap,
    managedMissions,
    employeeMissions,
    myAssignments,
    managedAssignments,
    globalSearchQuery,
    setGlobalSearchQuery,
  } = useWorkspace();

  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin';
  const todayISO = getTodayDoualaISO();

  const results = useMemo(
    () =>
      searchWorkspaceItems({
        query: globalSearchQuery,
        myTasks,
        publishedTasks,
        managedMissions,
        employeeMissions,
        myAssignments,
        managedAssignments,
        taskLabels,
        isManagerOrAdmin,
      }),
    [
      globalSearchQuery,
      myTasks,
      publishedTasks,
      managedMissions,
      employeeMissions,
      myAssignments,
      managedAssignments,
      taskLabels,
      isManagerOrAdmin,
    ]
  );

  const visibleTasks = results.tasks.slice(0, 5);
  const visibleMissions = results.missions.slice(0, 5);

  const flatItems = useMemo<NavigableItem[]>(() => {
    const items: NavigableItem[] = [];
    visibleTasks.forEach((t) =>
      items.push({ key: `task-${t.id}`, route: `/taches/${t.id}`, keepQuery: false })
    );
    visibleMissions.forEach((m) =>
      items.push({
        key: `mission-${m.id}`,
        route: m.targetRoute,
        keepQuery: !m.taskId,
      })
    );
    return items;
  }, [visibleTasks, visibleMissions]);

  // Raccourci clavier Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileExpanded(true);
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 20);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fermeture au clic extérieur
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!globalSearchQuery.trim()) {
          setMobileExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [globalSearchQuery]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [globalSearchQuery]);

  const handleSelectRoute = (route: string, keepQuery: boolean) => {
    setOpen(false);
    setMobileExpanded(false);
    if (!keepQuery) {
      setGlobalSearchQuery('');
    }
    navigate(route);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setMobileExpanded(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || flatItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && flatItems[activeIndex]) {
      e.preventDefault();
      const target = flatItems[activeIndex];
      handleSelectRoute(target.route, target.keepQuery);
    }
  };

  const hasQuery = globalSearchQuery.trim().length > 0;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md flex justify-end sm:justify-center">
      {/* Bouton loupe compact sur très petits écrans */}
      {!mobileExpanded && (
        <button
          type="button"
          onClick={() => {
            setMobileExpanded(true);
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 20);
          }}
          aria-label="Ouvrir la recherche globale"
          className="sm:hidden p-2 text-[#667085] dark:text-slate-300 hover:text-[#172D4D] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
        >
          <Search className="w-5 h-5" />
        </button>
      )}

      {/* Champ de recherche global (toujours visible dès sm, déroulant sur mobile) */}
      <div
        className={`${
          mobileExpanded
            ? 'fixed inset-x-0 top-0 h-16 bg-white dark:bg-[#111C2E] px-4 flex items-center gap-2 z-50 border-b border-slate-200 dark:border-slate-800 sm:static sm:h-auto sm:bg-transparent sm:dark:bg-transparent sm:px-0 sm:border-0'
            : 'hidden sm:flex'
        } w-full items-center`}
      >
        <div className="relative w-full">
          <Search
            className="w-4 h-4 text-[#667085] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open && hasQuery}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            aria-label="Rechercher des tâches, étiquettes et missions par mots-clés"
            value={globalSearchQuery}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setGlobalSearchQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Rechercher tâches, étiquettes, missions… (Ctrl+K)"
            className="w-full pl-9 pr-9 py-2 text-sm bg-[#F4F6FA] dark:bg-[#0B1320] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-[#0F172A] focus:border-[#3578C8] dark:focus:border-blue-400 transition-colors"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => {
                setGlobalSearchQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Effacer la recherche globale"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-white rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {mobileExpanded && (
          <button
            type="button"
            onClick={() => {
              setMobileExpanded(false);
              setOpen(false);
            }}
            className="sm:hidden px-2.5 py-2 text-xs font-semibold text-[#667085] dark:text-slate-300 hover:text-[#172D4D] dark:hover:text-white whitespace-nowrap cursor-pointer"
          >
            Fermer
          </button>
        )}
      </div>

      {/* Panneau de résultats instantanés */}
      {open && hasQuery && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Résultats de recherche globale"
          className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-0 top-[68px] sm:top-[calc(100%+8px)] bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden max-h-[75vh] flex flex-col"
        >
          <div className="px-4 py-2.5 bg-[#F4F6FA] dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs text-[#667085] dark:text-slate-400">
            <span>
              <strong className="text-[#172D4D] dark:text-slate-100 font-mono-num">
                {results.totalCount}
              </strong>{' '}
              résultat{results.totalCount > 1 ? 's' : ''} instantané
              {results.totalCount > 1 ? 's' : ''}
            </span>
            <span className="hidden sm:inline">Filtrage actif sur les listes</span>
          </div>

          {results.totalCount === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100">
                Aucune tâche ni mission trouvée pour « {globalSearchQuery.trim()} »
              </p>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
                Essayez un autre mot-clé (titre, étiquette, catégorie, collaborateur ou description).
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {/* Section Tâches */}
              {visibleTasks.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1.5 flex items-center justify-between text-[11px] font-semibold text-[#667085] dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-[#3578C8] dark:text-blue-400" />
                      Tâches ({results.tasks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleSelectRoute(
                          isManagerOrAdmin ? '/toutes-les-taches' : '/mes-taches',
                          true
                        )
                      }
                      className="text-[#3578C8] dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      Voir tout
                    </button>
                  </div>

                  <ul>
                    {visibleTasks.map((task, idx) => {
                      const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
                      const isHighlighted = activeIndex === idx;
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            onClick={() => handleSelectRoute(`/taches/${task.id}`, false)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`w-full text-left px-4 py-2.5 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-[#EAF2FC] dark:bg-[#172A45]'
                                : 'hover:bg-[#F4F6FA] dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 truncate">
                                {task.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                                <span>{task.ownerName}</span>
                                <span aria-hidden="true">·</span>
                                <span>{task.category}</span>
                                <span aria-hidden="true">·</span>
                                <StatusLabel status={task.status} overdue={overdue} />
                              </div>
                              <TaskLabelInlineList
                                labelIds={task.labelIds}
                                labelMap={taskLabelMap}
                                maxVisible={3}
                              />
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-xs font-mono-num text-[#172D4D] dark:text-slate-200 block">
                                {formatDateFR(task.dueAt)}
                              </span>
                              <PriorityLabel priority={task.priority} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Section Missions */}
              {visibleMissions.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1.5 flex items-center justify-between text-[11px] font-semibold text-[#667085] dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-[#172D4D] dark:text-slate-200" />
                      Missions ({results.missions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleSelectRoute(
                          isManagerOrAdmin ? '/toutes-les-missions' : '/mes-missions',
                          true
                        )
                      }
                      className="text-[#3578C8] dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      Voir tout
                    </button>
                  </div>

                  <ul>
                    {visibleMissions.map((mission, mIdx) => {
                      const flatIdx = visibleTasks.length + mIdx;
                      const isHighlighted = activeIndex === flatIdx;
                      return (
                        <li key={mission.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            onClick={() =>
                              handleSelectRoute(mission.targetRoute, !mission.taskId)
                            }
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            className={`w-full text-left px-4 py-2.5 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-[#EAF2FC] dark:bg-[#172A45]'
                                : 'hover:bg-[#F4F6FA] dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100 truncate">
                                {mission.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                                <span>{mission.category}</span>
                                <span aria-hidden="true">·</span>
                                <span>{mission.subtitle}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-xs font-mono-num text-[#172D4D] dark:text-slate-200 block">
                                {formatDateFR(mission.dueAt)}
                              </span>
                              <PriorityLabel priority={mission.priority} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Pied de recherche rapide */}
          <div className="px-4 py-2.5 bg-[#F4F6FA] dark:bg-[#0F172A] border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleSelectRoute(
                    isManagerOrAdmin ? '/toutes-les-taches' : '/mes-taches',
                    true
                  )
                }
                className="inline-flex items-center gap-1 font-medium text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Filtrer les tâches
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSelectRoute(
                    isManagerOrAdmin ? '/toutes-les-missions' : '/mes-missions',
                    true
                  )
                }
                className="inline-flex items-center gap-1 font-medium text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Filtrer les missions
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setGlobalSearchQuery('');
                setOpen(false);
              }}
              className="text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 cursor-pointer"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
