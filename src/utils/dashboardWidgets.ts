import type { Task, TaskPriority } from '../types';
import { isTaskOverdue, isTaskScheduledForToday } from './dateUtils';

export type DashboardWidgetId =
  | 'kpis'
  | 'priority_summary'
  | 'quick_shortcuts'
  | 'today_tasks'
  | 'upcoming_deadlines'
  | 'pending_missions'
  | 'weekly_trend'
  | 'status_breakdown'
  | 'recent_activity';

export type WidgetSpan = 'compact' | 'full';

export type PrioritySummaryFilter = 'all' | 'high_urgent' | 'overdue';

export interface DashboardWidgetPref {
  id: DashboardWidgetId;
  visible: boolean;
  span: WidgetSpan;
}

export interface CustomShortcut {
  id: string;
  label: string;
  to: string;
}

export interface EmployeeDashboardConfig {
  version: 1;
  widgets: DashboardWidgetPref[];
  enabledShortcuts: string[];
  customShortcuts: CustomShortcut[];
  prioritySummaryLimit: 3 | 5 | 8;
}

export interface WidgetCatalogEntry {
  id: DashboardWidgetId;
  title: string;
  description: string;
  defaultVisible: boolean;
  defaultSpan: WidgetSpan;
  resizable: boolean;
  compactColClass: string;
}

export interface BuiltinShortcutEntry {
  id: string;
  label: string;
  description: string;
  to: string;
  defaultEnabled: boolean;
  metricKey?: 'overdue' | 'urgent' | 'pendingMissions' | 'unreadNotifications' | 'todayCount';
}

export const EMPLOYEE_WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
  {
    id: 'kpis',
    title: 'Indicateurs clés',
    description: 'Synthèse chiffrée de vos tâches et missions en attente.',
    defaultVisible: true,
    defaultSpan: 'full',
    resizable: false,
    compactColClass: 'xl:col-span-12',
  },
  {
    id: 'priority_summary',
    title: 'Résumé des tâches prioritaires du jour',
    description: 'Focus sur vos urgences, retards et livrables prioritaires avec actions directes.',
    defaultVisible: true,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-7',
  },
  {
    id: 'quick_shortcuts',
    title: 'Raccourcis rapides',
    description: 'Accès direct aux vues clés et à vos raccourcis personnalisés.',
    defaultVisible: true,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-5',
  },
  {
    id: 'today_tasks',
    title: 'Mes tâches du jour',
    description: 'Liste détaillée des tâches planifiées aujourd’hui, dues ou en retard.',
    defaultVisible: true,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-8',
  },
  {
    id: 'upcoming_deadlines',
    title: 'Prochaines échéances',
    description: 'Calendrier des prochaines dates limites à anticiper.',
    defaultVisible: true,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-4',
  },
  {
    id: 'pending_missions',
    title: 'Suivi de mes missions',
    description: 'Missions en attente de réponse, corrections demandées et missions actives.',
    defaultVisible: false,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-6',
  },
  {
    id: 'weekly_trend',
    title: 'Évolution hebdomadaire',
    description: 'Courbe des tâches créées et clôturées sur les 6 dernières semaines.',
    defaultVisible: true,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-7',
  },
  {
    id: 'status_breakdown',
    title: 'Répartition par statut',
    description: 'Histogramme instantané de vos tâches selon leur avancement.',
    defaultVisible: true,
    defaultSpan: 'compact',
    resizable: true,
    compactColClass: 'xl:col-span-5',
  },
  {
    id: 'recent_activity',
    title: 'Activités récentes',
    description: 'Journal chronologique de vos dernières actions enregistrées.',
    defaultVisible: true,
    defaultSpan: 'full',
    resizable: true,
    compactColClass: 'xl:col-span-6',
  },
] as const;

export const WIDGET_CATALOG_MAP = new Map<DashboardWidgetId, WidgetCatalogEntry>(
  EMPLOYEE_WIDGET_CATALOG.map((w) => [w.id, w])
);

export const QUICK_SHORTCUT_CATALOG: readonly BuiltinShortcutEntry[] = [
  {
    id: 'create_task',
    label: 'Nouvelle tâche',
    description: 'Planifier une action',
    to: '/taches/nouvelle',
    defaultEnabled: true,
  },
  {
    id: 'overdue_tasks',
    label: 'Tâches en retard',
    description: 'Priorité immédiate',
    to: '/mes-taches?statut=overdue',
    defaultEnabled: true,
    metricKey: 'overdue',
  },
  {
    id: 'urgent_tasks',
    label: 'Tâches urgentes',
    description: 'Priorité urgente',
    to: '/mes-taches?priorite=urgent',
    defaultEnabled: true,
    metricKey: 'urgent',
  },
  {
    id: 'my_missions',
    label: 'Mes missions',
    description: 'Affectations reçues',
    to: '/mes-missions',
    defaultEnabled: true,
    metricKey: 'pendingMissions',
  },
  {
    id: 'planning',
    label: 'Mon planning',
    description: 'Vue semaine & mois',
    to: '/planning',
    defaultEnabled: true,
    metricKey: 'todayCount',
  },
  {
    id: 'reports',
    label: 'Mes rapports',
    description: 'Bilans PDF & CSV',
    to: '/mes-rapports',
    defaultEnabled: true,
  },
  {
    id: 'shared_workspace',
    label: 'Espace commun',
    description: 'Tâches publiées',
    to: '/espace-commun',
    defaultEnabled: false,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Alertes & rappels',
    to: '/notifications',
    defaultEnabled: false,
    metricKey: 'unreadNotifications',
  },
] as const;

export const CUSTOM_SHORTCUT_TARGETS: ReadonlyArray<{ label: string; to: string }> = [
  { label: 'Mes tâches — À faire', to: '/mes-taches?statut=todo' },
  { label: 'Mes tâches — En cours', to: '/mes-taches?statut=in_progress' },
  { label: 'Mes tâches — Bloquées', to: '/mes-taches?statut=blocked' },
  { label: 'Mes tâches — Priorité élevée', to: '/mes-taches?priorite=high' },
  { label: 'Mes tâches — Priorité urgente', to: '/mes-taches?priorite=urgent' },
  { label: 'Mes tâches — Terminées', to: '/mes-taches?statut=completed' },
  { label: 'Créer une tâche', to: '/taches/nouvelle' },
  { label: 'Mes missions', to: '/mes-missions' },
  { label: 'Mon planning', to: '/planning' },
  { label: 'Espace commun', to: '/espace-commun' },
  { label: 'Mes rapports', to: '/mes-rapports' },
  { label: 'Notifications', to: '/notifications' },
  { label: 'Mon profil', to: '/profil' },
  { label: 'Paramètres', to: '/parametres' },
];

const ALLOWED_CUSTOM_ROUTES = new Set(CUSTOM_SHORTCUT_TARGETS.map((item) => item.to));

export type DashboardPresetId = 'standard' | 'daily_focus' | 'analytics';

export const DASHBOARD_PRESETS: ReadonlyArray<{
  id: DashboardPresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Équilibre complet : KPIs, priorités du jour, raccourcis, planning et graphiques.',
  },
  {
    id: 'daily_focus',
    label: 'Focus quotidien',
    description: 'Essentiel opérationnel : priorités du jour, raccourcis, missions et tâches du jour.',
  },
  {
    id: 'analytics',
    label: 'Analyse & suivi',
    description: 'Pilotage : KPIs, graphiques d’évolution, échéances et journal d’activités.',
  },
];

const STORAGE_PREFIX = 'wellborne_flow_employee_dashboard_v1_';

export function getDashboardStorageKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}`;
}

export function createDefaultDashboardConfig(): EmployeeDashboardConfig {
  return {
    version: 1,
    widgets: EMPLOYEE_WIDGET_CATALOG.map((w) => ({
      id: w.id,
      visible: w.defaultVisible,
      span: w.defaultSpan,
    })),
    enabledShortcuts: QUICK_SHORTCUT_CATALOG.filter((s) => s.defaultEnabled).map((s) => s.id),
    customShortcuts: [],
    prioritySummaryLimit: 5,
  };
}

export function createPresetDashboardConfig(
  presetId: DashboardPresetId,
  existing?: EmployeeDashboardConfig
): EmployeeDashboardConfig {
  const base = createDefaultDashboardConfig();
  const customShortcuts = existing ? existing.customShortcuts : [];
  const enabledShortcuts = existing ? existing.enabledShortcuts : base.enabledShortcuts;
  const prioritySummaryLimit = existing ? existing.prioritySummaryLimit : base.prioritySummaryLimit;

  if (presetId === 'standard') {
    return {
      ...base,
      enabledShortcuts,
      customShortcuts,
      prioritySummaryLimit,
    };
  }

  if (presetId === 'daily_focus') {
    const order: DashboardWidgetId[] = [
      'priority_summary',
      'quick_shortcuts',
      'today_tasks',
      'pending_missions',
      'upcoming_deadlines',
      'kpis',
      'weekly_trend',
      'status_breakdown',
      'recent_activity',
    ];
    const visibleSet = new Set<DashboardWidgetId>([
      'priority_summary',
      'quick_shortcuts',
      'today_tasks',
      'pending_missions',
      'upcoming_deadlines',
    ]);
    return {
      version: 1,
      widgets: order.map((id) => {
        const entry = WIDGET_CATALOG_MAP.get(id)!;
        return {
          id,
          visible: visibleSet.has(id),
          span: id === 'pending_missions' ? 'compact' : entry.defaultSpan,
        };
      }),
      enabledShortcuts,
      customShortcuts,
      prioritySummaryLimit,
    };
  }

  // analytics
  const order: DashboardWidgetId[] = [
    'kpis',
    'weekly_trend',
    'status_breakdown',
    'upcoming_deadlines',
    'recent_activity',
    'priority_summary',
    'quick_shortcuts',
    'today_tasks',
    'pending_missions',
  ];
  const visibleSet = new Set<DashboardWidgetId>([
    'kpis',
    'weekly_trend',
    'status_breakdown',
    'upcoming_deadlines',
    'recent_activity',
  ]);
  return {
    version: 1,
    widgets: order.map((id) => {
      const entry = WIDGET_CATALOG_MAP.get(id)!;
      return {
        id,
        visible: visibleSet.has(id),
        span: id === 'upcoming_deadlines' ? 'full' : entry.defaultSpan,
      };
    }),
    enabledShortcuts,
    customShortcuts,
    prioritySummaryLimit,
  };
}

export function isAllowedCustomShortcutRoute(route: string): boolean {
  return ALLOWED_CUSTOM_ROUTES.has(route);
}

export function normalizeDashboardConfig(raw: unknown): EmployeeDashboardConfig {
  const fallback = createDefaultDashboardConfig();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<EmployeeDashboardConfig>;

  // 1. Widgets : préserver l'ordre valide + ajouter les éventuels nouveaux widgets du catalogue
  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidgetPref[] = [];
  if (Array.isArray(obj.widgets)) {
    for (const item of obj.widgets) {
      if (!item || typeof item !== 'object') continue;
      const id = item.id as DashboardWidgetId;
      const catalog = WIDGET_CATALOG_MAP.get(id);
      if (!catalog || seen.has(id)) continue;
      seen.add(id);
      const rawSpan: WidgetSpan = item.span === 'full' ? 'full' : 'compact';
      widgets.push({
        id,
        visible: typeof item.visible === 'boolean' ? item.visible : catalog.defaultVisible,
        span: catalog.resizable ? rawSpan : catalog.defaultSpan,
      });
    }
  }
  for (const catalog of EMPLOYEE_WIDGET_CATALOG) {
    if (!seen.has(catalog.id)) {
      widgets.push({
        id: catalog.id,
        visible: catalog.defaultVisible,
        span: catalog.defaultSpan,
      });
    }
  }

  // 2. Raccourcis intégrés valides
  const validShortcutIds = new Set(QUICK_SHORTCUT_CATALOG.map((s) => s.id));
  const enabledShortcuts = Array.isArray(obj.enabledShortcuts)
    ? Array.from(
        new Set(
          obj.enabledShortcuts.filter(
            (id): id is string => typeof id === 'string' && validShortcutIds.has(id)
          )
        )
      )
    : fallback.enabledShortcuts;

  // 3. Raccourcis personnalisés validés (max 4, routes internes uniquement)
  const customShortcuts: CustomShortcut[] = [];
  if (Array.isArray(obj.customShortcuts)) {
    for (const sc of obj.customShortcuts) {
      if (customShortcuts.length >= 4) break;
      if (!sc || typeof sc !== 'object') continue;
      const label = typeof sc.label === 'string' ? sc.label.trim().slice(0, 36) : '';
      const to = typeof sc.to === 'string' ? sc.to.trim() : '';
      const id = typeof sc.id === 'string' && sc.id.trim() ? sc.id.trim() : `custom_${customShortcuts.length + 1}`;
      if (label && isAllowedCustomShortcutRoute(to)) {
        customShortcuts.push({ id, label, to });
      }
    }
  }

  // 4. Limite du résumé prioritaire
  const limit = obj.prioritySummaryLimit === 3 || obj.prioritySummaryLimit === 8 ? obj.prioritySummaryLimit : 5;

  return {
    version: 1,
    widgets,
    enabledShortcuts,
    customShortcuts,
    prioritySummaryLimit: limit,
  };
}

export function loadEmployeeDashboardConfig(uid: string): EmployeeDashboardConfig {
  if (typeof window === 'undefined' || !uid) return createDefaultDashboardConfig();
  try {
    const raw = window.localStorage.getItem(getDashboardStorageKey(uid));
    if (!raw) return createDefaultDashboardConfig();
    return normalizeDashboardConfig(JSON.parse(raw));
  } catch {
    return createDefaultDashboardConfig();
  }
}

export function saveEmployeeDashboardConfig(uid: string, config: EmployeeDashboardConfig): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(getDashboardStorageKey(uid), JSON.stringify(config));
  } catch {
    // Ignore storage quota / private mode errors gracefully
  }
}

export function reorderWidgets(
  widgets: DashboardWidgetPref[],
  fromIndex: number,
  toIndex: number
): DashboardWidgetPref[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= widgets.length ||
    toIndex >= widgets.length ||
    fromIndex === toIndex
  ) {
    return widgets;
  }
  const next = [...widgets];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function moveWidgetByDelta(
  widgets: DashboardWidgetPref[],
  widgetId: DashboardWidgetId,
  delta: -1 | 1
): DashboardWidgetPref[] {
  const index = widgets.findIndex((w) => w.id === widgetId);
  if (index === -1) return widgets;
  return reorderWidgets(widgets, index, index + delta);
}

export function toggleWidgetVisibility(
  widgets: DashboardWidgetPref[],
  widgetId: DashboardWidgetId
): DashboardWidgetPref[] {
  return widgets.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w));
}

export function setWidgetSpan(
  widgets: DashboardWidgetPref[],
  widgetId: DashboardWidgetId,
  span: WidgetSpan
): DashboardWidgetPref[] {
  const catalog = WIDGET_CATALOG_MAP.get(widgetId);
  if (!catalog || !catalog.resizable) return widgets;
  return widgets.map((w) => (w.id === widgetId ? { ...w, span } : w));
}

export function getWidgetGridClass(widget: DashboardWidgetPref): string {
  if (widget.span === 'full') return 'xl:col-span-12';
  return WIDGET_CATALOG_MAP.get(widget.id)?.compactColClass ?? 'xl:col-span-6';
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export interface DailyPrioritySummaryData {
  overdueCount: number;
  highUrgentTodayCount: number;
  dueTodayCount: number;
  items: Task[];
  totalMatching: number;
}

/**
 * Sélectionne et hiérarchise les tâches prioritaires du jour pour un employé :
 * 1. Tâches actives en retard, planifiées/dues aujourd'hui ou de priorité élevée/urgente.
 * 2. Tri déterministe : retard d'abord, puis priorité (urgente -> faible), puis échéance la plus proche.
 */
export function selectDailyPriorityTasks(
  tasks: Task[],
  todayISO: string,
  filter: PrioritySummaryFilter = 'all',
  maxItems: number = 5
): DailyPrioritySummaryData {
  const active = tasks.filter((t) => !t.deletedAt && t.status !== 'completed' && t.status !== 'cancelled');

  const overdueCount = active.filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO)).length;
  const dueTodayCount = active.filter((t) => t.dueAt?.slice(0, 10) === todayISO).length;
  const highUrgentTodayCount = active.filter(
    (t) =>
      (t.priority === 'urgent' || t.priority === 'high') &&
      (isTaskScheduledForToday(t.plannedDate, t.dueAt, todayISO) ||
        isTaskOverdue(t.dueAt, t.status, todayISO))
  ).length;

  const candidates = active.filter((t) => {
    const overdue = isTaskOverdue(t.dueAt, t.status, todayISO);
    const today = isTaskScheduledForToday(t.plannedDate, t.dueAt, todayISO);
    const highOrUrgent = t.priority === 'urgent' || t.priority === 'high';

    if (filter === 'overdue') return overdue;
    if (filter === 'high_urgent') return highOrUrgent;
    return overdue || today || highOrUrgent;
  });

  const sorted = [...candidates].sort((a, b) => {
    const aOverdue = isTaskOverdue(a.dueAt, a.status, todayISO) ? 0 : 1;
    const bOverdue = isTaskOverdue(b.dueAt, b.status, todayISO) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    const aPrio = PRIORITY_WEIGHT[a.priority] ?? 9;
    const bPrio = PRIORITY_WEIGHT[b.priority] ?? 9;
    if (aPrio !== bPrio) return aPrio - bPrio;

    const aToday = isTaskScheduledForToday(a.plannedDate, a.dueAt, todayISO) ? 0 : 1;
    const bToday = isTaskScheduledForToday(b.plannedDate, b.dueAt, todayISO) ? 0 : 1;
    if (aToday !== bToday) return aToday - bToday;

    return (a.dueAt || '9999-12-31').localeCompare(b.dueAt || '9999-12-31');
  });

  return {
    overdueCount,
    highUrgentTodayCount,
    dueTodayCount,
    items: sorted.slice(0, Math.max(1, maxItems)),
    totalMatching: sorted.length,
  };
}
