import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Timestamp } from 'firebase/firestore';
import type { Mission, MissionAssignment, Task, TaskLabel } from '../src/types';
import {
  addDaysISO,
  getMonthGridISO,
  getPreviousWeekRangeDouala,
  getWeekDatesISO,
  isTaskOverdue,
  isTaskScheduledForToday,
} from '../src/utils/dateUtils';
import {
  matchesKeywords,
  normalizeSearchText,
  searchWorkspaceItems,
} from '../src/utils/searchUtils';
import {
  buildReportCsvContent,
  clampManualProgress,
  computeAutoProgress,
  computeReportMetrics,
  escapeCsvCell,
  sanitizeText,
} from '../src/utils/taskUtils';
import {
  createDefaultDashboardConfig,
  createPresetDashboardConfig,
  EMPLOYEE_WIDGET_CATALOG,
  moveWidgetByDelta,
  normalizeDashboardConfig,
  selectDailyPriorityTasks,
  setWidgetSpan,
  toggleWidgetVisibility,
} from '../src/utils/dashboardWidgets';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name}`);
    console.error('        ', err instanceof Error ? err.message : err);
  }
}

function fakeTimestamp(isoDate: string): Timestamp {
  const date = new Date(`${isoDate}T10:00:00+01:00`);
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as unknown as Timestamp;
}

console.log('\n=== WELLBORNE FLOW — Suite de tests métier & intégrité des règles ===\n');

// 1. Dates & retards (Africa/Douala)
runTest('Détection automatique de retard sur tâche active échue', () => {
  assert.equal(isTaskOverdue('2026-11-20', 'in_progress', '2026-11-23'), true);
  assert.equal(isTaskOverdue('2026-11-23', 'todo', '2026-11-23'), false);
  assert.equal(isTaskOverdue('2026-11-25', 'blocked', '2026-11-23'), false);
});

runTest('Les tâches terminées ou annulées ne sont jamais marquées en retard', () => {
  assert.equal(isTaskOverdue('2026-11-01', 'completed', '2026-11-23'), false);
  assert.equal(isTaskOverdue('2026-11-01', 'cancelled', '2026-11-23'), false);
});

runTest('Détection des tâches du jour (planifiées ou échéance aujourd’hui)', () => {
  assert.equal(isTaskScheduledForToday('2026-11-23', '2026-11-28', '2026-11-23'), true);
  assert.equal(isTaskScheduledForToday('2026-11-20', '2026-11-23', '2026-11-23'), true);
  assert.equal(isTaskScheduledForToday('2026-11-20', '2026-11-25', '2026-11-23'), false);
});

runTest('Calcul exact de la semaine précédente lundi -> dimanche (Africa/Douala)', () => {
  // 2026-11-23 est un lundi -> semaine précédente = 2026-11-16 (lun) au 2026-11-22 (dim)
  const mondayRef = new Date('2026-11-23T06:00:00+01:00');
  const range = getPreviousWeekRangeDouala(mondayRef);
  assert.equal(range.start, '2026-11-16');
  assert.equal(range.end, '2026-11-22');

  // 2026-11-22 est un dimanche -> semaine précédente = 2026-11-09 au 2026-11-15
  const sundayRef = new Date('2026-11-22T20:00:00+01:00');
  const sundayRange = getPreviousWeekRangeDouala(sundayRef);
  assert.equal(sundayRange.start, '2026-11-09');
  assert.equal(sundayRange.end, '2026-11-15');
});

runTest('Grille calendrier hebdomadaire (7 jours lundi->dimanche) et mensuelle (42 cellules)', () => {
  const week = getWeekDatesISO('2026-11-25');
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-11-23');
  assert.equal(week[6], '2026-11-29');

  const grid = getMonthGridISO(2026, 10); // Novembre 2026
  assert.equal(grid.length, 42);
  assert.equal(addDaysISO('2026-11-30', 1), '2026-12-01');
});

// 2. Progression automatique et manuelle
runTest('Calcul de progression automatique depuis les sous-tâches', () => {
  assert.equal(computeAutoProgress(0, 0), 0);
  assert.equal(computeAutoProgress(1, 3), 33);
  assert.equal(computeAutoProgress(2, 3), 67);
  assert.equal(computeAutoProgress(4, 4), 100);
});

runTest('Bornage de progression manuelle (0-99% avant complétion, 100% si terminée)', () => {
  assert.equal(clampManualProgress(100, false), 99);
  assert.equal(clampManualProgress(-15, false), 0);
  assert.equal(clampManualProgress(42.6, false), 43);
  assert.equal(clampManualProgress(40, true), 100);
});

runTest('Nettoyage et troncature de chaînes pour respecter le blueprint', () => {
  assert.equal(sanitizeText('  Bonjour WELLBORNE FLOW  ', 10), 'Bonjour WE');
});

// 3. Rapports & formule officielle de taux de réalisation
runTest('Formule officielle des rapports : taux de réalisation vs progression active', () => {
  const sampleTasks: Task[] = [
    // Tâche 1 : attendue dans la période, terminée à temps
    {
      id: 't1',
      title: 'Tâche 1',
      description: '',
      createdBy: 'u1',
      creatorName: 'Alice',
      ownerId: 'u1',
      ownerName: 'Alice',
      source: 'personal',
      startAt: '2026-11-16',
      plannedDate: '2026-11-17',
      dueAt: '2026-11-18',
      priority: 'normal',
      category: 'Opérations',
      status: 'completed',
      publicationStatus: 'published',
      progressMode: 'auto',
      progress: 100,
      subtaskCount: 2,
      completedSubtaskCount: 2,
      completedAt: fakeTimestamp('2026-11-18'),
      deletedAt: null,
      createdAt: fakeTimestamp('2026-11-16'),
      updatedAt: fakeTimestamp('2026-11-18'),
    },
    // Tâche 2 : attendue dans la période, terminée en retard
    {
      id: 't2',
      title: 'Tâche 2',
      description: '',
      createdBy: 'u1',
      creatorName: 'Alice',
      ownerId: 'u1',
      ownerName: 'Alice',
      source: 'personal',
      startAt: '2026-11-16',
      plannedDate: '2026-11-17',
      dueAt: '2026-11-18',
      priority: 'high',
      category: 'Opérations',
      status: 'completed',
      publicationStatus: 'published',
      progressMode: 'manual',
      progress: 100,
      subtaskCount: 0,
      completedSubtaskCount: 0,
      completedAt: fakeTimestamp('2026-11-20'),
      deletedAt: null,
      createdAt: fakeTimestamp('2026-11-16'),
      updatedAt: fakeTimestamp('2026-11-20'),
    },
    // Tâche 3 : attendue dans la période, encore en cours (60%) et en retard
    {
      id: 't3',
      title: 'Tâche 3',
      description: '',
      createdBy: 'u1',
      creatorName: 'Alice',
      ownerId: 'u1',
      ownerName: 'Alice',
      source: 'mission',
      missionId: 'm1',
      assignmentId: 'm1_u1',
      startAt: '2026-11-16',
      plannedDate: '2026-11-21',
      dueAt: '2026-11-19',
      priority: 'urgent',
      category: 'Développement',
      status: 'in_progress',
      publicationStatus: 'published',
      progressMode: 'manual',
      progress: 60,
      subtaskCount: 0,
      completedSubtaskCount: 0,
      completedAt: null,
      deletedAt: null,
      createdAt: fakeTimestamp('2026-11-16'),
      updatedAt: fakeTimestamp('2026-11-21'),
    },
    // Tâche 4 : supprimée logiquement (doit être exclue)
    {
      id: 't4',
      title: 'Tâche supprimée',
      description: '',
      createdBy: 'u1',
      creatorName: 'Alice',
      ownerId: 'u1',
      ownerName: 'Alice',
      source: 'personal',
      startAt: '2026-11-16',
      plannedDate: '2026-11-18',
      dueAt: '2026-11-18',
      priority: 'low',
      category: 'Administration',
      status: 'cancelled',
      publicationStatus: 'published',
      progressMode: 'manual',
      progress: 0,
      subtaskCount: 0,
      completedSubtaskCount: 0,
      completedAt: null,
      deletedAt: fakeTimestamp('2026-11-17'),
      createdAt: fakeTimestamp('2026-11-16'),
      updatedAt: fakeTimestamp('2026-11-17'),
    },
  ];

  // Mission multi-employés : deux affectations totalement indépendantes (u1 acceptée/validée, u2 refusée)
  const sampleAssignments: MissionAssignment[] = [
    {
      id: 'm1_u1',
      missionId: 'm1',
      missionTitle: 'Audit trimestriel',
      employeeId: 'u1',
      employeeName: 'Alice',
      assignedBy: 'mgr1',
      assignedByName: 'Marc',
      acceptanceStatus: 'accepted',
      workStatus: 'approved',
      taskId: 'm_m1_u1',
      progress: 100,
      priority: 'high',
      startAt: '2026-11-16',
      dueAt: '2026-11-20',
      createdAt: fakeTimestamp('2026-11-16'),
      updatedAt: fakeTimestamp('2026-11-19'),
    },
    {
      id: 'm1_u2',
      missionId: 'm1',
      missionTitle: 'Audit trimestriel',
      employeeId: 'u2',
      employeeName: 'Paul',
      assignedBy: 'mgr1',
      assignedByName: 'Marc',
      acceptanceStatus: 'rejected',
      workStatus: 'not_started',
      progress: 0,
      priority: 'high',
      startAt: '2026-11-16',
      dueAt: '2026-11-20',
      rejectionReason: 'En congé annuel',
      createdAt: fakeTimestamp('2026-11-16'),
      updatedAt: fakeTimestamp('2026-11-16'),
    },
  ];

  const result = computeReportMetrics(
    sampleTasks,
    sampleAssignments,
    '2026-11-16',
    '2026-11-22',
    '2026-11-23'
  );

  // 2 attendues terminées sur 3 attendues = 67%
  assert.equal(result.totals.tasksExpectedInPeriod, 3);
  assert.equal(result.totals.tasksCompletedInPeriod, 2);
  assert.equal(result.completionRate, 67);
  assert.equal(result.totals.tasksCompletedOnTime, 1);
  assert.equal(result.totals.tasksCompletedLate, 1);
  assert.equal(result.totals.tasksActive, 1);
  assert.equal(result.totals.tasksOverdue, 1);
  assert.equal(result.totals.tasksDeferred, 1);
  assert.equal(result.totals.averageActiveProgress, 60);
  assert.equal(result.totals.missionsReceived, 2);
  assert.equal(result.totals.missionsAccepted, 1);
  assert.equal(result.totals.missionsRejected, 1);
  assert.equal(result.totals.approvedCount, 1);
});

// 4. Vérification statique des invariants critiques de firestore.rules
runTest('Invariants de sécurité statiques dans firestore.rules', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // Default deny présent
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  // Vérification email_verified obligatoire
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  // Immutabilité des journaux d'audit
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*allow update: if false;[\s\S]*allow delete: if false;/);
  // Immutabilité des preuves de rappel
  assert.match(rules, /match \/reminderDeliveries\/\{deliveryId\}[\s\S]*allow update: if false;[\s\S]*allow delete: if false;/);
  // Pas de allow list ouvert à tout utilisateur connecté sans filtre
  assert.equal(/allow list:\s*if\s*isSignedIn\(\)\s*;/.test(rules), false);
  // Vérification atomique d'acceptation de mission avec existsAfter
  assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/tasks\/\$\(incoming\(\)\.taskId\)\)/);
  // Vérification que l'employé ne peut pas créer une tâche de mission pour l'affectation d'un autre
  assert.match(
    rules,
    /get\(\/databases\/\$\(database\)\/documents\/missionAssignments\/\$\(incoming\(\)\.assignmentId\)\)\.data\.employeeId == request\.auth\.uid/
  );
  // Vérification de la collection taskLabels et des étiquettes sur tasks
  assert.match(rules, /match \/taskLabels\/\{labelId\}/);
  assert.match(rules, /function isValidTaskLabel\(data\)/);
  assert.match(rules, /labelIds/);
  // Vérification miroir identique dans firebase/firestore.rules
  const mirrored = fs.readFileSync(path.resolve(process.cwd(), 'firebase/firestore.rules'), 'utf8');
  assert.equal(rules, mirrored);
});

// 5. Recherche globale insensible aux accents et multi-mots-clés
runTest('Normalisation et correspondance multi-mots-clés (insensible aux accents)', () => {
  assert.equal(normalizeSearchText('  Évaluation Trimestrielle — Développement  '), 'evaluation trimestrielle — developpement');
  assert.equal(matchesKeywords('evaluation dev', ['Évaluation annuelle', 'Développement']), true);
  assert.equal(matchesKeywords('audit finance', ['Audit comptable', 'Direction']), false);
});

runTest('Recherche globale instantanée tâches + missions avec déduplication', () => {
  const sharedTask: Task = {
    id: 'task-shared',
    title: 'Préparer le bilan budgétaire',
    description: 'Consolidation des chiffres Q4',
    createdBy: 'u1',
    creatorName: 'Alice Ndongo',
    ownerId: 'u1',
    ownerName: 'Alice Ndongo',
    source: 'personal',
    startAt: '2026-11-20',
    plannedDate: '2026-11-23',
    dueAt: '2026-11-25',
    priority: 'high',
    category: 'Administration',
    status: 'in_progress',
    publicationStatus: 'published',
    progressMode: 'manual',
    progress: 50,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    deletedAt: null,
    createdAt: fakeTimestamp('2026-11-20'),
    updatedAt: fakeTimestamp('2026-11-23'),
  };

  const mission: Mission = {
    id: 'mis-1',
    title: 'Déploiement bilan sécurité réseau',
    description: 'Audit complet des postes Douala',
    objectives: 'Sécuriser 100% des postes',
    instructions: 'Suivre la procédure interne',
    createdBy: 'mgr1',
    creatorName: 'Marc Fotso',
    startAt: '2026-11-20',
    dueAt: '2026-11-30',
    priority: 'urgent',
    status: 'published',
    category: 'Développement',
    checklistTemplate: [],
    assignedEmployeeIds: ['u1'],
    createdAt: fakeTimestamp('2026-11-20'),
    updatedAt: fakeTimestamp('2026-11-20'),
  };

  const assignment: MissionAssignment = {
    id: 'mis-1_u1',
    missionId: 'mis-1',
    missionTitle: mission.title,
    employeeId: 'u1',
    employeeName: 'Alice Ndongo',
    assignedBy: 'mgr1',
    assignedByName: 'Marc Fotso',
    acceptanceStatus: 'pending',
    workStatus: 'not_started',
    progress: 0,
    priority: 'urgent',
    startAt: '2026-11-20',
    dueAt: '2026-11-30',
    createdAt: fakeTimestamp('2026-11-20'),
    updatedAt: fakeTimestamp('2026-11-20'),
  };

  const res = searchWorkspaceItems({
    query: 'bilan',
    myTasks: [sharedTask],
    publishedTasks: [sharedTask], // doublon volontaire
    managedMissions: [mission],
    employeeMissions: [mission],
    myAssignments: [assignment],
    managedAssignments: [assignment],
    isManagerOrAdmin: true,
  });

  assert.equal(res.tasks.length, 1);
  assert.equal(res.missions.length, 1);
  assert.equal(res.totalCount, 2);
});

runTest('Recherche globale sur les étiquettes personnalisées (priorité, département, projet)', () => {
  const labels: TaskLabel[] = [
    {
      id: 'lbl-dept-fin',
      name: 'Département Finance',
      group: 'department',
      color: 'blue',
      workspaceVisibility: 'company',
      createdBy: 'u1',
      createdByName: 'Alice Ndongo',
      createdAt: fakeTimestamp('2026-11-20'),
      updatedAt: fakeTimestamp('2026-11-20'),
    },
    {
      id: 'lbl-proj-erp',
      name: 'Migration ERP',
      group: 'project_type',
      color: 'emerald',
      workspaceVisibility: 'company',
      createdBy: 'u1',
      createdByName: 'Alice Ndongo',
      createdAt: fakeTimestamp('2026-11-20'),
      updatedAt: fakeTimestamp('2026-11-20'),
    },
  ];

  const labeledTask: Task = {
    id: 'task-labeled',
    title: 'Validation des écritures mensuelles',
    description: 'Contrôle comptable',
    createdBy: 'u1',
    creatorName: 'Alice Ndongo',
    ownerId: 'u1',
    ownerName: 'Alice Ndongo',
    source: 'personal',
    startAt: '2026-11-20',
    plannedDate: '2026-11-23',
    dueAt: '2026-11-26',
    priority: 'normal',
    category: 'Administration',
    labelIds: ['lbl-dept-fin', 'lbl-proj-erp'],
    status: 'todo',
    publicationStatus: 'published',
    progressMode: 'manual',
    progress: 0,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    deletedAt: null,
    createdAt: fakeTimestamp('2026-11-20'),
    updatedAt: fakeTimestamp('2026-11-20'),
  };

  const byDept = searchWorkspaceItems({
    query: 'departement finance',
    myTasks: [labeledTask],
    publishedTasks: [],
    managedMissions: [],
    employeeMissions: [],
    myAssignments: [],
    managedAssignments: [],
    isManagerOrAdmin: false,
    taskLabels: labels,
  });

  const byProject = searchWorkspaceItems({
    query: 'erp',
    myTasks: [labeledTask],
    publishedTasks: [],
    managedMissions: [],
    employeeMissions: [],
    myAssignments: [],
    managedAssignments: [],
    isManagerOrAdmin: false,
    taskLabels: labels,
  });

  assert.equal(byDept.tasks.length, 1);
  assert.equal(byDept.tasks[0].id, 'task-labeled');
  assert.equal(byProject.tasks.length, 1);
  assert.equal(byProject.tasks[0].id, 'task-labeled');
});

// 6. Export CSV tableur (Excel FR / International) & sécurité formules
runTest('Échappement CSV RFC 4180 et protection contre l’injection de formules Excel', () => {
  assert.equal(escapeCsvCell('Bilan "Q4"'), '"Bilan ""Q4"""');
  assert.equal(escapeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
  assert.equal(escapeCsvCell('+237690000000'), '"+237690000000"');
  assert.equal(escapeCsvCell('+CMD|\' /C calc\'!A0'), '"\'+CMD|\' /C calc\'!A0"');
  assert.equal(escapeCsvCell('@malicious'), '"\'@malicious"');
  assert.equal(escapeCsvCell(-12), '"-12"');
  assert.equal(escapeCsvCell(null), '""');
});

runTest('Génération CSV des rapports de performance (complet + tableaux plats Excel/Sheets)', () => {
  const sampleTotals = {
    tasksCreated: 4,
    tasksPlanned: 4,
    tasksExpectedInPeriod: 3,
    tasksCompletedInPeriod: 2,
    tasksCompletedOnTime: 1,
    tasksCompletedLate: 1,
    tasksActive: 1,
    tasksOverdue: 1,
    tasksDeferred: 0,
    missionsReceived: 2,
    missionsAccepted: 1,
    missionsRejected: 1,
    submissionsCount: 1,
    approvedCount: 1,
    averageActiveProgress: 60,
  };

  const breakdown = [
    {
      name: 'Alice Ndongo',
      department: 'Finance',
      total: 4,
      expected: 3,
      completed: 2,
      completedOnTime: 1,
      completedLate: 1,
      overdue: 1,
      averageActiveProgress: 60,
      missionsReceived: 2,
      missionsApproved: 1,
      completionRate: 67,
    },
  ];

  const csvTasks = [
    {
      title: 'Clôture comptable "Novembre"',
      ownerName: 'Alice Ndongo',
      category: 'Administration',
      labels: ['Finance', 'Priorité haute'],
      priority: 'high' as const,
      status: 'in_progress' as const,
      plannedDate: '2026-11-20',
      dueAt: '2026-11-22',
      progress: 60,
      overdue: true,
    },
  ];

  const csvMissions = [
    {
      missionTitle: 'Audit trimestriel',
      employeeName: 'Alice Ndongo',
      assignedByName: 'Marc Fotso',
      priority: 'urgent' as const,
      acceptanceStatus: 'accepted' as const,
      workStatus: 'approved' as const,
      dueAt: '2026-11-22',
      progress: 100,
    },
  ];

  const completeFr = buildReportCsvContent(
    'Rapport collectif d’activité',
    '2026-11-16',
    '2026-11-22',
    sampleTotals,
    67,
    breakdown,
    {
      dataset: 'complete',
      delimiter: ';',
      companyName: 'NHR Digital',
      generatedByName: 'Marc Fotso',
      tasks: csvTasks,
      missions: csvMissions,
    }
  );

  assert.equal(completeFr.filename, 'wellborne-flow-rapport-2026-11-16-2026-11-22.csv');
  assert.equal(completeFr.content.startsWith('\uFEFF'), true);
  assert.match(completeFr.content, /"NHR Digital"/);
  assert.match(completeFr.content, /"PERFORMANCE PAR COLLABORATEUR"/);
  assert.match(completeFr.content, /"DÉTAIL DES TÂCHES DE LA PÉRIODE"/);
  assert.match(completeFr.content, /"Finance, Priorité haute"/);
  assert.match(completeFr.content, /"DÉTAIL DES MISSIONS DE LA PÉRIODE"/);
  assert.match(completeFr.content, /"Audit trimestriel";"Alice Ndongo"/);

  const flatTasksIntl = buildReportCsvContent(
    'Rapport collectif',
    '2026-11-16',
    '2026-11-22',
    sampleTotals,
    67,
    breakdown,
    {
      dataset: 'tasks',
      delimiter: ',',
      tasks: csvTasks,
    }
  );
  assert.equal(flatTasksIntl.filename, 'wellborne-flow-taches-2026-11-16-2026-11-22.csv');
  const lines = flatTasksIntl.content.replace(/^\uFEFF/, '').split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^"Tâche","Responsable","Catégorie","Étiquettes"/);
  assert.match(lines[1], /"Clôture comptable ""Novembre"""/);

  const flatEmployees = buildReportCsvContent(
    'Rapport collectif',
    '2026-11-16',
    '2026-11-22',
    sampleTotals,
    67,
    breakdown,
    { dataset: 'employees', delimiter: ';' }
  );
  assert.equal(flatEmployees.filename, 'wellborne-flow-collaborateurs-2026-11-16-2026-11-22.csv');
  assert.match(flatEmployees.content, /"Alice Ndongo";"Finance";"4";"3";"2"/);
});

// 8. Widgets personnalisables du tableau de bord employé
runTest('Normalisation, réorganisation, largeur et préréglages des widgets employé', () => {
  const def = createDefaultDashboardConfig();
  assert.equal(def.widgets.length, EMPLOYEE_WIDGET_CATALOG.length);
  assert.equal(def.widgets.find((w) => w.id === 'priority_summary')?.visible, true);
  assert.equal(def.widgets.find((w) => w.id === 'quick_shortcuts')?.visible, true);

  // Déplacement + visibilité + largeur
  const moved = moveWidgetByDelta(def.widgets, 'quick_shortcuts', -1);
  assert.equal(moved[1].id, 'quick_shortcuts');

  const toggled = toggleWidgetVisibility(moved, 'recent_activity');
  assert.equal(toggled.find((w) => w.id === 'recent_activity')?.visible, false);

  const resized = setWidgetSpan(toggled, 'priority_summary', 'full');
  assert.equal(resized.find((w) => w.id === 'priority_summary')?.span, 'full');
  // kpis n'est pas redimensionnable -> reste 'full'
  const kpiUnchanged = setWidgetSpan(resized, 'kpis', 'compact');
  assert.equal(kpiUnchanged.find((w) => w.id === 'kpis')?.span, 'full');

  // Normalisation défensive : routes externes rejetées, widgets manquants restaurés
  const normalized = normalizeDashboardConfig({
    version: 1,
    widgets: [{ id: 'quick_shortcuts', visible: true, span: 'full' }],
    enabledShortcuts: ['create_task', 'unknown_id'],
    customShortcuts: [
      { id: 'c1', label: 'Urgences', to: '/mes-taches?priorite=urgent' },
      { id: 'c2', label: 'Malveillant', to: 'https://evil.example.com' },
    ],
    prioritySummaryLimit: 8,
  });
  assert.equal(normalized.widgets.length, EMPLOYEE_WIDGET_CATALOG.length);
  assert.equal(normalized.widgets[0].id, 'quick_shortcuts');
  assert.deepEqual(normalized.enabledShortcuts, ['create_task']);
  assert.equal(normalized.customShortcuts.length, 1);
  assert.equal(normalized.customShortcuts[0].label, 'Urgences');
  assert.equal(normalized.prioritySummaryLimit, 8);

  // Préréglage Focus quotidien préserve les raccourcis personnalisés
  const focus = createPresetDashboardConfig('daily_focus', normalized);
  assert.equal(focus.widgets[0].id, 'priority_summary');
  assert.equal(focus.customShortcuts.length, 1);
});

runTest('Classement du résumé des tâches prioritaires du jour (retards puis priorité)', () => {
  const baseTask = (overrides: Partial<Task>): Task => ({
    id: 't',
    title: 'Tâche',
    description: '',
    ownerId: 'u1',
    ownerName: 'Alice',
    createdBy: 'u1',
    source: 'personal',
    missionId: null,
    assignmentId: null,
    publicationStatus: 'published',
    status: 'todo',
    priority: 'normal',
    category: 'Opérations',
    startAt: '2026-11-20',
    plannedDate: '2026-11-25',
    dueAt: '2026-11-25',
    progress: 0,
    progressMode: 'manual',
    subtasksCount: 0,
    completedSubtasksCount: 0,
    commentsCount: 0,
    completedAt: null,
    deletedAt: null,
    createdAt: fakeTimestamp('2026-11-20'),
    updatedAt: fakeTimestamp('2026-11-20'),
    ...overrides,
  });

  const tasks: Task[] = [
    baseTask({ id: 'normal_today', title: 'Normale du jour', priority: 'normal', dueAt: '2026-11-25' }),
    baseTask({ id: 'urgent_today', title: 'Urgente du jour', priority: 'urgent', dueAt: '2026-11-25' }),
    baseTask({ id: 'overdue_high', title: 'Élevée en retard', priority: 'high', dueAt: '2026-11-22' }),
    baseTask({ id: 'done_urgent', title: 'Déjà terminée', priority: 'urgent', status: 'completed', dueAt: '2026-11-22' }),
    baseTask({ id: 'low_future', title: 'Faible future', priority: 'low', plannedDate: '2026-11-29', dueAt: '2026-11-30' }),
  ];

  const allSummary = selectDailyPriorityTasks(tasks, '2026-11-25', 'all', 5);
  assert.equal(allSummary.overdueCount, 1);
  assert.equal(allSummary.highUrgentTodayCount, 2);
  assert.equal(allSummary.dueTodayCount, 2);
  assert.deepEqual(
    allSummary.items.map((t) => t.id),
    ['overdue_high', 'urgent_today', 'normal_today']
  );

  const overdueOnly = selectDailyPriorityTasks(tasks, '2026-11-25', 'overdue', 5);
  assert.deepEqual(
    overdueOnly.items.map((t) => t.id),
    ['overdue_high']
  );
});

console.log(`\nRésultat : ${passed} réussi(s), ${failed} échoué(s)\n`);
if (failed > 0) {
  process.exit(1);
}
