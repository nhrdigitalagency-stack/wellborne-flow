import type { Mission, MissionAssignment, Task, TaskLabel } from '../types';

export function getTaskLabelNames(
  task: Pick<Task, 'labelIds'>,
  labelMap: Map<string, TaskLabel>
): string[] {
  if (!task.labelIds || task.labelIds.length === 0) return [];
  const names: string[] = [];
  for (const id of task.labelIds) {
    const label = labelMap.get(id);
    if (label) names.push(label.name);
  }
  return names;
}

/**
 * Normalise une chaîne pour une recherche insensible à la casse et aux accents (français).
 */
export function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Vérifie que TOUS les mots-clés de `query` apparaissent dans au moins un des champs fournis.
 */
export function matchesKeywords(
  query: string,
  fields: Array<string | undefined | null>
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = fields.map((f) => normalizeSearchText(f)).join(' ');
  return tokens.every((token) => haystack.includes(token));
}

export interface GlobalSearchMissionHit {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Mission['priority'];
  dueAt: string;
  subtitle: string;
  targetRoute: string;
  taskId?: string | null;
}

export interface GlobalSearchResults {
  tasks: Task[];
  missions: GlobalSearchMissionHit[];
  totalCount: number;
}

/**
 * Filtre instantanément les tâches et missions accessibles à l'utilisateur par mots-clés.
 */
export function searchWorkspaceItems(params: {
  query: string;
  myTasks: Task[];
  publishedTasks: Task[];
  managedMissions: Mission[];
  employeeMissions: Mission[];
  myAssignments: MissionAssignment[];
  managedAssignments: MissionAssignment[];
  taskLabels?: TaskLabel[];
  isManagerOrAdmin: boolean;
}): GlobalSearchResults {
  const {
    query,
    myTasks,
    publishedTasks,
    managedMissions,
    employeeMissions,
    myAssignments,
    managedAssignments,
    taskLabels = [],
    isManagerOrAdmin,
  } = params;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return { tasks: [], missions: [], totalCount: 0 };
  }

  const labelMap = new Map(taskLabels.map((l) => [l.id, l]));

  // 1. Dédupliquer les tâches accessibles (mes tâches + tâches publiées de l'entreprise)
  const taskMap = new Map<string, Task>();
  for (const t of publishedTasks) {
    if (!t.deletedAt) taskMap.set(t.id, t);
  }
  for (const t of myTasks) {
    if (!t.deletedAt) taskMap.set(t.id, t);
  }

  const matchedTasks = Array.from(taskMap.values())
    .filter((t) =>
      matchesKeywords(normalizedQuery, [
        t.title,
        t.description,
        t.category,
        t.ownerName,
        t.creatorName,
        ...getTaskLabelNames(t, labelMap),
      ])
    )
    .sort((a, b) => {
      const aTitleMatch = normalizeSearchText(a.title).includes(normalizedQuery) ? 0 : 1;
      const bTitleMatch = normalizeSearchText(b.title).includes(normalizedQuery) ? 0 : 1;
      if (aTitleMatch !== bTitleMatch) return aTitleMatch - bTitleMatch;
      return (a.dueAt || '').localeCompare(b.dueAt || '');
    });

  // 2. Dédupliquer les missions accessibles selon le rôle
  const missionHits: GlobalSearchMissionHit[] = [];
  const seenMissionIds = new Set<string>();

  if (isManagerOrAdmin) {
    const assignsByMission = new Map<string, MissionAssignment[]>();
    for (const a of managedAssignments) {
      const list = assignsByMission.get(a.missionId) || [];
      list.push(a);
      assignsByMission.set(a.missionId, list);
    }

    for (const m of managedMissions) {
      const assigns = assignsByMission.get(m.id) || [];
      const assigneeNames = assigns.map((a) => a.employeeName).join(' ');
      if (
        matchesKeywords(normalizedQuery, [
          m.title,
          m.description,
          m.objectives,
          m.instructions,
          m.category,
          m.creatorName,
          assigneeNames,
        ])
      ) {
        seenMissionIds.add(m.id);
        missionHits.push({
          id: m.id,
          title: m.title,
          description: m.description,
          category: m.category,
          priority: m.priority,
          dueAt: m.dueAt,
          subtitle: `${assigns.length} collaborateur${assigns.length > 1 ? 's' : ''} affecté${assigns.length > 1 ? 's' : ''}`,
          targetRoute: '/toutes-les-missions',
        });
      }
    }
  }

  // Ajouter aussi les missions reçues par l'utilisateur (pour les employés et managers affectés)
  const employeeMissionMap = new Map(employeeMissions.map((m) => [m.id, m]));
  for (const a of myAssignments) {
    if (seenMissionIds.has(a.missionId)) continue;
    const mission = employeeMissionMap.get(a.missionId);
    if (
      matchesKeywords(normalizedQuery, [
        a.missionTitle,
        a.assignedByName,
        a.employeeName,
        mission?.description,
        mission?.objectives,
        mission?.instructions,
        mission?.category,
      ])
    ) {
      seenMissionIds.add(a.missionId);
      missionHits.push({
        id: a.missionId,
        title: a.missionTitle,
        description: mission?.description || '',
        category: mission?.category || 'Mission',
        priority: a.priority,
        dueAt: a.dueAt,
        subtitle: `Attribuée par ${a.assignedByName}`,
        targetRoute: a.taskId ? `/taches/${a.taskId}` : '/mes-missions',
        taskId: a.taskId,
      });
    }
  }

  missionHits.sort((a, b) => {
    const aTitleMatch = normalizeSearchText(a.title).includes(normalizedQuery) ? 0 : 1;
    const bTitleMatch = normalizeSearchText(b.title).includes(normalizedQuery) ? 0 : 1;
    if (aTitleMatch !== bTitleMatch) return aTitleMatch - bTitleMatch;
    return (a.dueAt || '').localeCompare(b.dueAt || '');
  });

  return {
    tasks: matchedTasks,
    missions: missionHits,
    totalCount: matchedTasks.length + missionHits.length,
  };
}
