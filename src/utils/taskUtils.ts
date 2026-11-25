import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AcceptanceStatus,
  AccountStatus,
  MissionAssignment,
  ReportTotals,
  Task,
  TaskPriority,
  TaskStatus,
  UserRole,
  WorkStatus,
} from '../types';
import { formatDateFR, getTodayDoualaISO, isTaskOverdue, timestampToDoualaISO } from './dateUtils';

export const TASK_CATEGORIES = [
  'Développement',
  'Design & Produit',
  'Marketing & Commercial',
  'Administration',
  'Opérations',
  'Support client',
  'Ressources humaines',
  'Direction & Stratégie',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Responsable',
  employee: 'Employé',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Actif',
  pending: 'En attente d’activation',
  suspended: 'Suspendu',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Faible',
  normal: 'Normale',
  high: 'Élevée',
  urgent: 'Urgente',
};

export const PRIORITY_TEXT_CLASS: Record<TaskPriority, string> = {
  low: 'text-[#667085] dark:text-slate-400',
  normal: 'text-[#3578C8] dark:text-blue-400',
  high: 'text-[#D97706] dark:text-amber-400 font-semibold',
  urgent: 'text-[#DC4545] dark:text-red-400 font-semibold',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  blocked: 'En attente / bloquée',
  submitted: 'Soumise pour validation',
  changes_requested: 'Corrections demandées',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

export const STATUS_TEXT_CLASS: Record<TaskStatus, string> = {
  todo: 'text-[#667085] dark:text-slate-400',
  in_progress: 'text-[#3578C8] dark:text-blue-400 font-medium',
  blocked: 'text-[#D97706] dark:text-amber-400 font-medium',
  submitted: 'text-[#172D4D] dark:text-slate-100 font-semibold',
  changes_requested: 'text-[#DC4545] dark:text-red-400 font-semibold',
  completed: 'text-[#16A36A] dark:text-emerald-400 font-medium',
  cancelled: 'text-[#94A3B8] dark:text-slate-500 line-through',
};

export const ACCEPTANCE_LABELS: Record<AcceptanceStatus, string> = {
  pending: 'En attente de réponse',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  not_started: 'Non démarrée',
  in_progress: 'En cours',
  blocked: 'Bloquée',
  submitted: 'Soumise pour validation',
  changes_requested: 'Corrections demandées',
  approved: 'Validée',
};

/**
 * Calcule la progression automatique : (terminées / total) * 100 arrondi.
 */
export function computeAutoProgress(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  const raw = Math.round((completedCount / totalCount) * 100);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Limite la progression manuelle entre 0 et 99 tant que la tâche n'est pas terminée.
 */
export function clampManualProgress(value: number, isCompleted: boolean): number {
  if (isCompleted) return 100;
  return Math.max(0, Math.min(99, Math.round(value)));
}

/**
 * Tronque et nettoie les chaînes entrantes pour garantir la conformité avec firebase-blueprint.json.
 */
export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Calcule les indicateurs de rapport selon les définitions documentées (Section 11.5) :
 * - Taux de réalisation = (tâches attendues terminées dans la période / tâches attendues dans la période) × 100
 * - Distingué explicitement de la progression moyenne des tâches actives.
 */
export function computeReportMetrics(
  tasks: Task[],
  assignments: MissionAssignment[],
  periodStart: string,
  periodEnd: string,
  todayISO: string = getTodayDoualaISO()
): { totals: ReportTotals; completionRate: number } {
  const nonDeletedTasks = tasks.filter((t) => !t.deletedAt && t.status !== 'cancelled');

  const tasksCreated = nonDeletedTasks.filter((t) => {
    const createdDay = timestampToDoualaISO(t.createdAt);
    return createdDay !== null && createdDay >= periodStart && createdDay <= periodEnd;
  }).length;

  const tasksPlanned = nonDeletedTasks.filter((t) => {
    const p = t.plannedDate?.slice(0, 10);
    return Boolean(p && p >= periodStart && p <= periodEnd);
  }).length;

  // Tâches attendues pendant la période (échéance dueAt comprise dans [periodStart, periodEnd])
  const expectedTasks = nonDeletedTasks.filter((t) => {
    const d = t.dueAt?.slice(0, 10);
    return Boolean(d && d >= periodStart && d <= periodEnd);
  });

  const completedInPeriod = nonDeletedTasks.filter((t) => {
    if (t.status !== 'completed') return false;
    const completedDay = timestampToDoualaISO(t.completedAt) ?? timestampToDoualaISO(t.updatedAt);
    return completedDay !== null && completedDay >= periodStart && completedDay <= periodEnd;
  });

  const expectedAndCompleted = expectedTasks.filter((t) => t.status === 'completed');

  const tasksCompletedOnTime = completedInPeriod.filter((t) => {
    const completedDay = timestampToDoualaISO(t.completedAt) ?? timestampToDoualaISO(t.updatedAt);
    const dueDay = t.dueAt?.slice(0, 10);
    return Boolean(completedDay && dueDay && completedDay <= dueDay);
  }).length;

  const tasksCompletedLate = completedInPeriod.length - tasksCompletedOnTime;

  const activeTasks = nonDeletedTasks.filter((t) => t.status !== 'completed');
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO));
  const deferredTasks = nonDeletedTasks.filter((t) => {
    const p = t.plannedDate?.slice(0, 10);
    const d = t.dueAt?.slice(0, 10);
    return Boolean(p && d && p > d && t.status !== 'completed');
  }).length;

  const periodAssignments = assignments.filter((a) => {
    const createdDay = timestampToDoualaISO(a.createdAt);
    const dueDay = a.dueAt?.slice(0, 10);
    return (
      (createdDay !== null && createdDay >= periodStart && createdDay <= periodEnd) ||
      Boolean(dueDay && dueDay >= periodStart && dueDay <= periodEnd)
    );
  });

  const missionsReceived = periodAssignments.length;
  const missionsAccepted = periodAssignments.filter((a) => a.acceptanceStatus === 'accepted').length;
  const missionsRejected = periodAssignments.filter((a) => a.acceptanceStatus === 'rejected').length;
  const submissionsCount = periodAssignments.filter(
    (a) => a.workStatus === 'submitted' || a.workStatus === 'approved' || a.workStatus === 'changes_requested'
  ).length;
  const approvedCount = periodAssignments.filter((a) => a.workStatus === 'approved').length;

  const averageActiveProgress =
    activeTasks.length > 0
      ? Math.round(activeTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / activeTasks.length)
      : 0;

  // Formule officielle documentée : tâches attendues terminées / tâches attendues × 100
  const completionRate =
    expectedTasks.length > 0
      ? Math.round((expectedAndCompleted.length / expectedTasks.length) * 100)
      : completedInPeriod.length > 0
      ? 100
      : 0;

  return {
    totals: {
      tasksCreated,
      tasksPlanned,
      tasksExpectedInPeriod: expectedTasks.length,
      tasksCompletedInPeriod: completedInPeriod.length,
      tasksCompletedOnTime,
      tasksCompletedLate,
      tasksActive: activeTasks.length,
      tasksOverdue: overdueTasks.length,
      tasksDeferred: deferredTasks,
      missionsReceived,
      missionsAccepted,
      missionsRejected,
      submissionsCount,
      approvedCount,
      averageActiveProgress,
    },
    completionRate,
  };
}

export type CsvDelimiter = ';' | ',';

export type ReportCsvDataset = 'complete' | 'employees' | 'tasks' | 'missions';

export interface ReportEmployeeBreakdownRow {
  name: string;
  department?: string;
  total: number;
  expected?: number;
  completed: number;
  completedOnTime?: number;
  completedLate?: number;
  overdue: number;
  averageActiveProgress?: number;
  missionsReceived?: number;
  missionsApproved?: number;
  completionRate: number;
}

export interface ReportCsvTaskRow {
  title: string;
  ownerName: string;
  category: string;
  labels: string[];
  priority: TaskPriority;
  status: TaskStatus;
  plannedDate?: string | null;
  dueAt: string;
  progress: number;
  overdue: boolean;
}

export interface ReportCsvMissionRow {
  missionTitle: string;
  employeeName: string;
  assignedByName?: string;
  priority: TaskPriority;
  acceptanceStatus: AcceptanceStatus;
  workStatus: WorkStatus;
  dueAt: string;
  progress: number;
}

export interface ReportCsvOptions {
  dataset?: ReportCsvDataset;
  delimiter?: CsvDelimiter;
  companyName?: string;
  generatedByName?: string;
  tasks?: ReportCsvTaskRow[];
  missions?: ReportCsvMissionRow[];
}

/**
 * Protège et échappe une cellule CSV selon RFC 4180 + neutralisation d'injection de formules Excel.
 */
export function escapeCsvCell(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  const isPureSignedNumber = /^[+-]\d+([.,]\d+)?%?$/.test(str.trim());
  if (!isPureSignedNumber && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Sérialise un tableau 2D en CSV UTF-8 avec BOM et fins de ligne CRLF pour Excel / LibreOffice / Google Sheets.
 */
export function serializeCsvRows(
  rows: Array<Array<string | number | boolean | null | undefined>>,
  delimiter: CsvDelimiter = ';'
): string {
  return (
    '\uFEFF' +
    rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(delimiter))
      .join('\r\n')
  );
}

/**
 * Construit le contenu CSV et le nom de fichier selon le jeu de données choisi (bilan complet ou tableau plat TCD).
 */
export function buildReportCsvContent(
  title: string,
  periodStart: string,
  periodEnd: string,
  totals: ReportTotals,
  completionRate: number,
  employeeBreakdown?: ReportEmployeeBreakdownRow[],
  options?: ReportCsvOptions
): { content: string; filename: string } {
  const dataset: ReportCsvDataset = options?.dataset ?? 'complete';
  const delimiter: CsvDelimiter = options?.delimiter ?? ';';
  const companyName = options?.companyName?.trim() || 'WELLBORNE FLOW';
  const generatedByName = options?.generatedByName?.trim();
  const tasks = options?.tasks ?? [];
  const missions = options?.missions ?? [];

  const rows: Array<Array<string | number | boolean | null | undefined>> = [];

  if (dataset === 'employees') {
    rows.push([
      'Collaborateur',
      'Département',
      'Total tâches',
      'Attendues (période)',
      'Terminées (période)',
      'Terminées à temps',
      'Terminées en retard',
      'Actives en retard',
      'Progression moy. active (%)',
      'Missions reçues',
      'Missions validées',
      'Taux de réalisation (%)',
    ]);
    for (const emp of employeeBreakdown ?? []) {
      rows.push([
        emp.name,
        emp.department || '',
        emp.total,
        emp.expected ?? '',
        emp.completed,
        emp.completedOnTime ?? '',
        emp.completedLate ?? '',
        emp.overdue,
        emp.averageActiveProgress ?? '',
        emp.missionsReceived ?? '',
        emp.missionsApproved ?? '',
        emp.completionRate,
      ]);
    }
    return {
      content: serializeCsvRows(rows, delimiter),
      filename: `wellborne-flow-collaborateurs-${periodStart}-${periodEnd}.csv`,
    };
  }

  if (dataset === 'tasks') {
    rows.push([
      'Tâche',
      'Responsable',
      'Catégorie',
      'Étiquettes',
      'Priorité',
      'Statut',
      'Planifiée le',
      'Échéance',
      'En retard',
      'Progression (%)',
    ]);
    for (const task of tasks) {
      rows.push([
        task.title,
        task.ownerName,
        task.category || '',
        task.labels.join(', '),
        PRIORITY_LABELS[task.priority],
        STATUS_LABELS[task.status],
        task.plannedDate ? formatDateFR(task.plannedDate) : '',
        formatDateFR(task.dueAt),
        task.overdue ? 'Oui' : 'Non',
        task.progress,
      ]);
    }
    return {
      content: serializeCsvRows(rows, delimiter),
      filename: `wellborne-flow-taches-${periodStart}-${periodEnd}.csv`,
    };
  }

  if (dataset === 'missions') {
    rows.push([
      'Mission',
      'Collaborateur',
      'Assignée par',
      'Priorité',
      'Réponse',
      'Avancement travail',
      'Échéance',
      'Progression (%)',
    ]);
    for (const mission of missions) {
      rows.push([
        mission.missionTitle,
        mission.employeeName,
        mission.assignedByName || '',
        PRIORITY_LABELS[mission.priority],
        ACCEPTANCE_LABELS[mission.acceptanceStatus],
        WORK_STATUS_LABELS[mission.workStatus],
        formatDateFR(mission.dueAt),
        mission.progress,
      ]);
    }
    return {
      content: serializeCsvRows(rows, delimiter),
      filename: `wellborne-flow-missions-${periodStart}-${periodEnd}.csv`,
    };
  }

  // Jeu de données "complete" : Synthèse + Collaborateurs + Détail tâches + Détail missions
  const exportedAt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Douala',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  rows.push(
    ['WELLBORNE FLOW — Bilan de performance', title],
    ['Entreprise', companyName],
    ['Période', `${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}`],
    ['Fuseau horaire', 'Africa/Douala'],
    ['Exporté le', exportedAt],
    ...(generatedByName ? [['Exporté par', generatedByName]] : []),
    ['Formule taux de réalisation', 'Tâches attendues terminées / Tâches attendues dans la période × 100'],
    [],
    ['Indicateur de performance', 'Valeur', 'Unité'],
    ['Taux de réalisation officiel', completionRate, '%'],
    ['Tâches créées dans la période', totals.tasksCreated, 'tâches'],
    ['Tâches planifiées dans la période', totals.tasksPlanned, 'tâches'],
    ['Tâches attendues (échéance période)', totals.tasksExpectedInPeriod, 'tâches'],
    ['Tâches terminées (période)', totals.tasksCompletedInPeriod, 'tâches'],
    ['Tâches terminées à temps', totals.tasksCompletedOnTime, 'tâches'],
    ['Tâches terminées en retard', totals.tasksCompletedLate, 'tâches'],
    ['Tâches actives', totals.tasksActive, 'tâches'],
    ['Tâches en retard', totals.tasksOverdue, 'tâches'],
    ['Tâches reportées', totals.tasksDeferred, 'tâches'],
    ['Progression moyenne des tâches actives', totals.averageActiveProgress, '%'],
    ['Missions reçues', totals.missionsReceived, 'missions'],
    ['Missions acceptées', totals.missionsAccepted, 'missions'],
    ['Missions refusées', totals.missionsRejected, 'missions'],
    ['Travaux soumis pour validation', totals.submissionsCount, 'missions'],
    ['Travaux validés', totals.approvedCount, 'missions']
  );

  if (employeeBreakdown && employeeBreakdown.length > 0) {
    rows.push([]);
    rows.push(['PERFORMANCE PAR COLLABORATEUR']);
    rows.push([
      'Collaborateur',
      'Département',
      'Total tâches',
      'Attendues',
      'Terminées',
      'À temps',
      'En retard (actives)',
      'Progression moy. active (%)',
      'Missions validées',
      'Missions reçues',
      'Taux de réalisation (%)',
    ]);
    for (const emp of employeeBreakdown) {
      rows.push([
        emp.name,
        emp.department || '',
        emp.total,
        emp.expected ?? '',
        emp.completed,
        emp.completedOnTime ?? '',
        emp.overdue,
        emp.averageActiveProgress ?? '',
        emp.missionsApproved ?? '',
        emp.missionsReceived ?? '',
        emp.completionRate,
      ]);
    }
  }

  if (tasks.length > 0) {
    rows.push([]);
    rows.push(['DÉTAIL DES TÂCHES DE LA PÉRIODE']);
    rows.push([
      'Tâche',
      'Responsable',
      'Catégorie',
      'Étiquettes',
      'Priorité',
      'Statut',
      'Planifiée le',
      'Échéance',
      'En retard',
      'Progression (%)',
    ]);
    for (const task of tasks) {
      rows.push([
        task.title,
        task.ownerName,
        task.category || '',
        task.labels.join(', '),
        PRIORITY_LABELS[task.priority],
        STATUS_LABELS[task.status],
        task.plannedDate ? formatDateFR(task.plannedDate) : '',
        formatDateFR(task.dueAt),
        task.overdue ? 'Oui' : 'Non',
        task.progress,
      ]);
    }
  }

  if (missions.length > 0) {
    rows.push([]);
    rows.push(['DÉTAIL DES MISSIONS DE LA PÉRIODE']);
    rows.push([
      'Mission',
      'Collaborateur',
      'Assignée par',
      'Priorité',
      'Réponse',
      'Avancement travail',
      'Échéance',
      'Progression (%)',
    ]);
    for (const mission of missions) {
      rows.push([
        mission.missionTitle,
        mission.employeeName,
        mission.assignedByName || '',
        PRIORITY_LABELS[mission.priority],
        ACCEPTANCE_LABELS[mission.acceptanceStatus],
        WORK_STATUS_LABELS[mission.workStatus],
        formatDateFR(mission.dueAt),
        mission.progress,
      ]);
    }
  }

  return {
    content: serializeCsvRows(rows, delimiter),
    filename: `wellborne-flow-rapport-${periodStart}-${periodEnd}.csv`,
  };
}

/**
 * Exporte un rapport en fichier CSV UTF-8 avec BOM pour Excel, LibreOffice Calc et Google Sheets.
 */
export function exportReportToCSV(
  title: string,
  periodStart: string,
  periodEnd: string,
  totals: ReportTotals,
  completionRate: number,
  employeeBreakdown?: ReportEmployeeBreakdownRow[],
  options?: ReportCsvOptions
): string {
  const { content, filename } = buildReportCsvContent(
    title,
    periodStart,
    periodEnd,
    totals,
    completionRate,
    employeeBreakdown,
    options
  );

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export interface ReportPdfKeyTask {
  title: string;
  ownerName: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string;
  progress: number;
  overdue: boolean;
}

export interface ReportPdfOptions {
  companyName?: string;
  generatedByName?: string;
  keyTasks?: ReportPdfKeyTask[];
}

/**
 * Exporte un bilan de performance structuré en PDF A4 prêt à imprimer ou partager (jsPDF + autoTable).
 */
export function exportReportToPDF(
  title: string,
  subtitle: string,
  periodStart: string,
  periodEnd: string,
  totals: ReportTotals,
  completionRate: number,
  employeeBreakdown?: Array<{
    name: string;
    total: number;
    completed: number;
    overdue: number;
    completionRate: number;
  }>,
  options?: ReportPdfOptions
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const companyName = options?.companyName?.trim() || 'WELLBORNE FLOW';
  const generatedByName = options?.generatedByName?.trim();
  const generatedDate = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Douala',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  // 1. Bandeau identité WELLBORNE FLOW + entreprise
  doc.setFillColor(23, 45, 77); // #172D4D
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('WELLBORNE FLOW', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${companyName} — Bilan de performance (Africa/Douala)`, 14, 19);
  doc.setFontSize(8.5);
  doc.setTextColor(214, 226, 245);
  doc.text(`Généré le ${generatedDate}${generatedByName ? ` par ${generatedByName}` : ''}`, 14, 25);

  // 2. Titre & période du bilan
  doc.setTextColor(23, 45, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 41);

  doc.setTextColor(102, 112, 133);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${subtitle} · Période : ${formatDateFR(periodStart)} au ${formatDateFR(periodEnd)}`,
    14,
    47.5
  );

  // 3. Bandeau synthétique 4 KPI exécutifs
  const kpiCards = [
    {
      label: 'Taux de réalisation',
      value: `${completionRate} %`,
      sub: `${totals.tasksCompletedOnTime} à temps · ${totals.tasksCompletedLate} retard`,
      accent: completionRate >= 80 ? ([22, 163, 106] as const) : completionRate >= 50 ? ([53, 120, 200] as const) : ([217, 119, 6] as const),
    },
    {
      label: 'Attendues / Terminées',
      value: `${totals.tasksCompletedInPeriod} / ${totals.tasksExpectedInPeriod}`,
      sub: `${totals.tasksCreated} créées · ${totals.tasksPlanned} planifiées`,
      accent: [23, 45, 77] as const,
    },
    {
      label: 'Actives / En retard',
      value: `${totals.tasksActive} / ${totals.tasksOverdue}`,
      sub: `Prog. moy. active : ${totals.averageActiveProgress} %`,
      accent: totals.tasksOverdue > 0 ? ([220, 69, 69] as const) : ([23, 45, 77] as const),
    },
    {
      label: 'Missions validées',
      value: `${totals.approvedCount} / ${totals.missionsReceived}`,
      sub: `${totals.missionsAccepted} accept. · ${totals.missionsRejected} refus`,
      accent: [53, 120, 200] as const,
    },
  ];

  const cardWidth = 43.5;
  const cardGap = 2.6;
  kpiCards.forEach((card, idx) => {
    const x = 14 + idx * (cardWidth + cardGap);
    const y = 53;
    doc.setFillColor(244, 246, 250);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, 23, 1.8, 1.8, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(102, 112, 133);
    doc.text(card.label, x + 3, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.text(card.value, x + 3, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(102, 112, 133);
    doc.text(card.sub, x + 3, y + 19.8);
  });

  // 4. Encadré méthode officielle
  doc.setFillColor(234, 242, 252);
  doc.roundedRect(14, 80, 182, 12, 1.8, 1.8, 'F');
  doc.setTextColor(23, 45, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Méthode de calcul officielle :', 18, 85.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Taux de réalisation = (Tâches attendues terminées dans la période / Tâches attendues dans la période) × 100.',
    18,
    89.8
  );

  // 5. Tableau complet des indicateurs
  autoTable(doc, {
    startY: 96,
    head: [['Indicateur de performance', 'Valeur']],
    body: [
      ['Taux de réalisation officiel', `${completionRate} %`],
      ['Tâches créées dans la période', String(totals.tasksCreated)],
      ['Tâches planifiées dans la période', String(totals.tasksPlanned)],
      ['Tâches attendues (échéance sur la période)', String(totals.tasksExpectedInPeriod)],
      ['Tâches terminées (total période)', String(totals.tasksCompletedInPeriod)],
      ['  • Dont terminées à temps', String(totals.tasksCompletedOnTime)],
      ['  • Dont terminées en retard', String(totals.tasksCompletedLate)],
      ['Tâches actives en cours', String(totals.tasksActive)],
      ['Tâches en retard', String(totals.tasksOverdue)],
      ['Tâches reportées', String(totals.tasksDeferred)],
      ['Progression moyenne des tâches actives', `${totals.averageActiveProgress} %`],
      ['Missions reçues / affectations', String(totals.missionsReceived)],
      ['Missions acceptées', String(totals.missionsAccepted)],
      ['Missions refusées', String(totals.missionsRejected)],
      ['Travaux soumis pour validation', String(totals.submissionsCount)],
      ['Travaux validés', String(totals.approvedCount)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [23, 45, 77], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [23, 45, 77] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14, bottom: 20 },
  });

  // 6. Répartition par collaborateur (bilan collectif)
  if (employeeBreakdown && employeeBreakdown.length > 0) {
    const sorted = [...employeeBreakdown].sort((a, b) => b.completionRate - a.completionRate);
    let nextY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 190) + 10;
    if (nextY > 245) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 45, 77);
    doc.text('Performance par collaborateur', 14, nextY);

    autoTable(doc, {
      startY: nextY + 4,
      head: [['Collaborateur', 'Total', 'Terminées', 'En retard', 'Taux réalisation']],
      body: sorted.map((e) => [
        e.name,
        String(e.total),
        String(e.completed),
        String(e.overdue),
        `${e.completionRate} %`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [53, 120, 200], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [23, 45, 77] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });
  }

  // 7. Synthèse des tâches clés / points d'attention de la période
  if (options?.keyTasks && options.keyTasks.length > 0) {
    let nextY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200) + 10;
    if (nextY > 240) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 45, 77);
    doc.text(
      `Détail des tâches de la période (${options.keyTasks.length}${options.keyTasks.length === 15 ? ' max affichées' : ''})`,
      14,
      nextY
    );

    autoTable(doc, {
      startY: nextY + 4,
      head: [['Tâche', 'Responsable', 'Priorité', 'Statut', 'Échéance', 'Prog.']],
      body: options.keyTasks.map((t) => [
        t.title.length > 44 ? `${t.title.slice(0, 41)}…` : t.title,
        t.ownerName,
        PRIORITY_LABELS[t.priority],
        t.overdue ? `${STATUS_LABELS[t.status]} (Retard)` : STATUS_LABELS[t.status],
        formatDateFR(t.dueAt),
        `${t.progress} %`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [23, 45, 77], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [23, 45, 77] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 20 },
    });
  }

  // 8. Pied de page numéroté sur chaque page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 284, 196, 284);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 133);
    doc.text(`WELLBORNE FLOW · ${companyName} · Document interne de suivi`, 14, 289.5);
    doc.text(`Page ${p} / ${pageCount}`, 196, 289.5, { align: 'right' });
  }

  const filename = `wellborne-flow-bilan-${periodStart}-${periodEnd}.pdf`;
  doc.save(filename);
  return filename;
}

