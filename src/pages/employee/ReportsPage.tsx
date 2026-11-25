import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Printer, Save } from 'lucide-react';
import { StatCard, TableSkeleton } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { saveReportSnapshot } from '../../services/reports/reportService';
import type { ActivityReport, Task } from '../../types';
import {
  formatDateFR,
  formatTimestampFR,
  getCurrentMonthRangeDouala,
  getCurrentWeekRangeDouala,
  getPreviousWeekRangeDouala,
  getTodayDoualaISO,
  isTaskOverdue,
  timestampToDoualaISO,
} from '../../utils/dateUtils';
import {
  computeReportMetrics,
  exportReportToCSV,
  exportReportToPDF,
  type CsvDelimiter,
  type ReportCsvDataset,
  type ReportCsvMissionRow,
  type ReportCsvTaskRow,
} from '../../utils/taskUtils';

type PeriodPreset = 'prev_week' | 'current_week' | 'current_month' | 'custom';

export function ReportsPage({ allowCollective = false }: { allowCollective?: boolean }) {
  const { profile, orgSettings } = useAuth();
  const { isDark } = useTheme();
  const {
    myTasks,
    publishedTasks,
    taskLabelMap,
    myAssignments,
    managedAssignments,
    teamDirectory,
    savedReports,
    dataReady,
  } = useWorkspace();
  const { showToast } = useToast();

  const canSeeCollective = Boolean(
    allowCollective && profile && (profile.role === 'manager' || profile.role === 'admin')
  );

  const [scope, setScope] = useState<'individual' | 'collective'>(
    canSeeCollective ? 'collective' : 'individual'
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(profile?.uid || '');
  const [preset, setPreset] = useState<PeriodPreset>('current_month');

  const initialRange = getCurrentMonthRangeDouala();
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [csvMenuOpen, setCsvMenuOpen] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState<CsvDelimiter>(';');
  const csvMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!csvMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (csvMenuRef.current && !csvMenuRef.current.contains(event.target as Node)) {
        setCsvMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCsvMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [csvMenuOpen]);

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    if (p === 'prev_week') {
      const r = getPreviousWeekRangeDouala();
      setPeriodStart(r.start);
      setPeriodEnd(r.end);
    } else if (p === 'current_week') {
      const r = getCurrentWeekRangeDouala();
      setPeriodStart(r.start);
      setPeriodEnd(r.end);
    } else if (p === 'current_month') {
      const r = getCurrentMonthRangeDouala();
      setPeriodStart(r.start);
      setPeriodEnd(r.end);
    }
  };

  const allAccessibleTasks = useMemo(() => {
    const map = new Map<string, Task>();
    publishedTasks.forEach((t) => map.set(t.id, t));
    myTasks.forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  }, [publishedTasks, myTasks]);

  const effectiveEmployeeId = canSeeCollective ? selectedEmployeeId || profile?.uid || '' : profile?.uid || '';

  const targetEmployee = useMemo(
    () => teamDirectory.find((u) => u.uid === effectiveEmployeeId),
    [teamDirectory, effectiveEmployeeId]
  );

  const reportTasks = useMemo(() => {
    if (scope === 'collective' && canSeeCollective) return allAccessibleTasks;
    return allAccessibleTasks.filter((t) => t.ownerId === effectiveEmployeeId);
  }, [scope, canSeeCollective, allAccessibleTasks, effectiveEmployeeId]);

  const reportAssignments = useMemo(() => {
    if (scope === 'collective' && canSeeCollective) return managedAssignments;
    if (effectiveEmployeeId === profile?.uid) return myAssignments;
    return managedAssignments.filter((a) => a.employeeId === effectiveEmployeeId);
  }, [scope, canSeeCollective, managedAssignments, myAssignments, effectiveEmployeeId, profile?.uid]);

  const { totals, completionRate } = useMemo(
    () => computeReportMetrics(reportTasks, reportAssignments, periodStart, periodEnd),
    [reportTasks, reportAssignments, periodStart, periodEnd]
  );

  const employeeBreakdown = useMemo(() => {
    if (scope !== 'collective' || !canSeeCollective) return [];
    const todayISO = getTodayDoualaISO();
    return teamDirectory
      .filter((u) => u.accountStatus === 'active')
      .map((u) => {
        const empTasks = allAccessibleTasks.filter((t) => t.ownerId === u.uid && !t.deletedAt);
        const empAssigns = managedAssignments.filter((a) => a.employeeId === u.uid);
        const metrics = computeReportMetrics(empTasks, empAssigns, periodStart, periodEnd, todayISO);
        return {
          uid: u.uid,
          name: `${u.firstName} ${u.lastName}`,
          department: u.department || '',
          total: empTasks.length,
          expected: metrics.totals.tasksExpectedInPeriod,
          completed: metrics.totals.tasksCompletedInPeriod,
          completedOnTime: metrics.totals.tasksCompletedOnTime,
          completedLate: metrics.totals.tasksCompletedLate,
          overdue: empTasks.filter((t) => isTaskOverdue(t.dueAt, t.status, todayISO)).length,
          averageActiveProgress: metrics.totals.averageActiveProgress,
          missionsReceived: metrics.totals.missionsReceived,
          missionsApproved: metrics.totals.approvedCount,
          completionRate: metrics.completionRate,
        };
      });
  }, [scope, canSeeCollective, teamDirectory, allAccessibleTasks, managedAssignments, periodStart, periodEnd]);

  const reportTitle =
    scope === 'collective'
      ? 'Rapport collectif d’activité de l’entreprise'
      : `Rapport individuel — ${
          targetEmployee
            ? `${targetEmployee.firstName} ${targetEmployee.lastName}`
            : `${profile?.firstName || ''} ${profile?.lastName || ''}`
        }`;

  const handleSaveSnapshot = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await saveReportSnapshot(profile, {
        type: scope,
        periodKind:
          preset === 'prev_week' || preset === 'current_week'
            ? 'weekly'
            : preset === 'current_month'
            ? 'monthly'
            : 'custom',
        employeeId: scope === 'individual' ? effectiveEmployeeId : null,
        employeeName:
          scope === 'individual'
            ? targetEmployee
              ? `${targetEmployee.firstName} ${targetEmployee.lastName}`
              : `${profile.firstName} ${profile.lastName}`
            : null,
        periodStart,
        periodEnd,
        totals,
        completionRate,
      });
      showToast('Rapport archivé dans Firestore.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur archivage rapport', 'error');
    } finally {
      setSaving(false);
    }
  };

  const keyTasksForPdf = useMemo(() => {
    const todayISO = getTodayDoualaISO();
    return reportTasks
      .filter((t) => {
        if (t.deletedAt || t.status === 'cancelled') return false;
        const dueDay = t.dueAt?.slice(0, 10) || '';
        return dueDay >= periodStart && dueDay <= periodEnd;
      })
      .map((t) => ({
        title: t.title,
        ownerName: t.ownerName,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt,
        progress: t.progress,
        overdue: isTaskOverdue(t.dueAt, t.status, todayISO),
      }))
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueAt.localeCompare(b.dueAt))
      .slice(0, 15);
  }, [reportTasks, periodStart, periodEnd]);

  const handleExportPDF = () => {
    setExportingPdf(true);
    try {
      const filename = exportReportToPDF(
        reportTitle,
        scope === 'collective' ? 'Synthèse générale de l’équipe' : 'Bilan individuel de performance',
        periodStart,
        periodEnd,
        totals,
        completionRate,
        employeeBreakdown,
        {
          companyName: orgSettings.companyName,
          generatedByName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
          keyTasks: keyTasksForPdf,
        }
      );
      showToast(`Bilan PDF généré et téléchargé (${filename}).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Impossible de générer le bilan PDF.',
        'error'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportArchivedPDF = (report: ActivityReport) => {
    try {
      const archivedTitle =
        report.type === 'collective'
          ? 'Rapport collectif archivé'
          : `Rapport individuel archivé — ${report.employeeName || ''}`;
      const filename = exportReportToPDF(
        archivedTitle,
        'Archive officielle WELLBORNE FLOW',
        report.periodStart,
        report.periodEnd,
        report.totals,
        report.completionRate,
        undefined,
        {
          companyName: orgSettings.companyName,
          generatedByName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
        }
      );
      showToast(`Archive PDF téléchargée (${filename}).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erreur lors de l’export PDF de l’archive.',
        'error'
      );
    }
  };

  const periodTasksForCsv = useMemo<ReportCsvTaskRow[]>(() => {
    const todayISO = getTodayDoualaISO();
    return reportTasks
      .filter((t) => {
        if (t.deletedAt || t.status === 'cancelled') return false;
        const dueDay = t.dueAt?.slice(0, 10) || '';
        const plannedDay = t.plannedDate?.slice(0, 10) || '';
        const createdDay = timestampToDoualaISO(t.createdAt) || '';
        return (
          (dueDay >= periodStart && dueDay <= periodEnd) ||
          (plannedDay >= periodStart && plannedDay <= periodEnd) ||
          (createdDay >= periodStart && createdDay <= periodEnd)
        );
      })
      .map((t) => ({
        title: t.title,
        ownerName: t.ownerName,
        category: t.category || '',
        labels: (t.labelIds || [])
          .map((id) => taskLabelMap.get(id)?.name)
          .filter((name): name is string => Boolean(name)),
        priority: t.priority,
        status: t.status,
        plannedDate: t.plannedDate || null,
        dueAt: t.dueAt,
        progress: t.progress,
        overdue: isTaskOverdue(t.dueAt, t.status, todayISO),
      }))
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueAt.localeCompare(b.dueAt));
  }, [reportTasks, periodStart, periodEnd, taskLabelMap]);

  const periodMissionsForCsv = useMemo<ReportCsvMissionRow[]>(() => {
    return reportAssignments
      .filter((a) => {
        const createdDay = timestampToDoualaISO(a.createdAt) || '';
        const dueDay = a.dueAt?.slice(0, 10) || '';
        return (
          (createdDay >= periodStart && createdDay <= periodEnd) ||
          (dueDay >= periodStart && dueDay <= periodEnd)
        );
      })
      .map((a) => ({
        missionTitle: a.missionTitle,
        employeeName: a.employeeName,
        assignedByName: a.assignedByName,
        priority: a.priority,
        acceptanceStatus: a.acceptanceStatus,
        workStatus: a.workStatus,
        dueAt: a.dueAt,
        progress: a.progress,
      }))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [reportAssignments, periodStart, periodEnd]);

  const handleExportCSV = (dataset: ReportCsvDataset = 'complete') => {
    try {
      const filename = exportReportToCSV(
        reportTitle,
        periodStart,
        periodEnd,
        totals,
        completionRate,
        employeeBreakdown,
        {
          dataset,
          delimiter: csvDelimiter,
          companyName: orgSettings.companyName,
          generatedByName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
          tasks: periodTasksForCsv,
          missions: periodMissionsForCsv,
        }
      );
      setCsvMenuOpen(false);
      showToast(`Export CSV téléchargé (${filename}).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Impossible de générer le fichier CSV.',
        'error'
      );
    }
  };

  const handleExportArchivedCSV = (report: ActivityReport) => {
    try {
      const archivedTitle =
        report.type === 'collective'
          ? 'Rapport collectif archivé'
          : `Rapport individuel archivé — ${report.employeeName || ''}`;
      const filename = exportReportToCSV(
        archivedTitle,
        report.periodStart,
        report.periodEnd,
        report.totals,
        report.completionRate,
        undefined,
        {
          dataset: 'complete',
          delimiter: csvDelimiter,
          companyName: orgSettings.companyName,
          generatedByName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
        }
      );
      showToast(`Archive CSV téléchargée (${filename}).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erreur lors de l’export CSV de l’archive.',
        'error'
      );
    }
  };

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
      {/* En-tête dédié à l'impression papier */}
      <div className="hidden print:block border-b-2 border-[#172D4D] pb-4 mb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs font-semibold text-[#3578C8]">{orgSettings.companyName} · WELLBORNE FLOW</p>
            <h1 className="text-xl font-bold font-display text-[#172D4D] mt-0.5">{reportTitle}</h1>
          </div>
          <p className="text-xs font-mono-num text-[#667085]">
            Période : {formatDateFR(periodStart)} au {formatDateFR(periodEnd)} (Africa/Douala)
          </p>
        </div>
      </div>

      {/* Header & Exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            {reportTitle}
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            Période : {formatDateFR(periodStart)} au {formatDateFR(periodEnd)} (Africa/Douala)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveSnapshot}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            Archiver
          </button>
          <div className="relative" ref={csvMenuRef}>
            <button
              type="button"
              onClick={() => setCsvMenuOpen((prev) => !prev)}
              aria-expanded={csvMenuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#16A36A] dark:text-emerald-400" />
              Exporter en CSV
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {csvMenuOpen && (
              <div
                role="menu"
                aria-label="Options d’export CSV"
                className="absolute right-0 mt-2 w-76 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 overflow-hidden"
              >
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-[#F4F6FA] dark:bg-[#0F172A]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085] dark:text-slate-400">
                    Format tableur (Excel, Sheets, Calc)
                  </p>
                  <div className="mt-1.5 inline-flex items-center bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-md p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCsvDelimiter(';')}
                      className={`px-2 py-1 rounded cursor-pointer font-medium ${
                        csvDelimiter === ';'
                          ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                          : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-200'
                      }`}
                    >
                      Excel FR ( ; )
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvDelimiter(',')}
                      className={`px-2 py-1 rounded cursor-pointer font-medium ${
                        csvDelimiter === ','
                          ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
                          : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-200'
                      }`}
                    >
                      International ( , )
                    </button>
                  </div>
                </div>

                <div className="py-1 divide-y divide-slate-100 dark:divide-slate-800/80">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExportCSV('complete')}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/80 cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                      Bilan complet (.csv)
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-slate-400 mt-0.5">
                      KPI officiels, équipe, tâches et missions de la période
                    </p>
                  </button>

                  {scope === 'collective' && canSeeCollective && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExportCSV('employees')}
                      disabled={employeeBreakdown.length === 0}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/80 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                          Tableau collaborateurs (.csv)
                        </p>
                        <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
                          {employeeBreakdown.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#667085] dark:text-slate-400 mt-0.5">
                        1 ligne par membre — prêt pour tableaux croisés dynamiques
                      </p>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExportCSV('tasks')}
                    disabled={periodTasksForCsv.length === 0}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/80 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                        Détail des tâches (.csv)
                      </p>
                      <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
                        {periodTasksForCsv.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#667085] dark:text-slate-400 mt-0.5">
                      Catégories, étiquettes personnalisées, statuts et retards
                    </p>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleExportCSV('missions')}
                    disabled={periodMissionsForCsv.length === 0}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/80 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                        Détail des missions (.csv)
                      </p>
                      <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
                        {periodMissionsForCsv.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#667085] dark:text-slate-400 mt-0.5">
                      Affectations, acceptations, validations et avancement
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] rounded-lg cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {exportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Exporter en PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#667085] dark:text-slate-300 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:text-[#172D4D] dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 flex flex-wrap items-center gap-3 no-print">
        {canSeeCollective && (
          <div className="inline-flex items-center bg-[#F4F6FA] dark:bg-[#0F172A] rounded-lg p-1">
            <button
              type="button"
              onClick={() => setScope('collective')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                scope === 'collective'
                  ? 'bg-white dark:bg-[#1E293B] text-[#172D4D] dark:text-slate-100 shadow-sm'
                  : 'text-[#667085] dark:text-slate-400'
              }`}
            >
              Rapport collectif
            </button>
            <button
              type="button"
              onClick={() => setScope('individual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                scope === 'individual'
                  ? 'bg-white dark:bg-[#1E293B] text-[#172D4D] dark:text-slate-100 shadow-sm'
                  : 'text-[#667085] dark:text-slate-400'
              }`}
            >
              Rapport individuel
            </button>
          </div>
        )}

        {canSeeCollective && scope === 'individual' && (
          <select
            value={effectiveEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            aria-label="Sélectionner un collaborateur"
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
          >
            {teamDirectory.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        )}

        <div className="inline-flex items-center bg-[#F4F6FA] dark:bg-[#0F172A] rounded-lg p-1">
          {(
            [
              { id: 'prev_week', label: 'Semaine préc.' },
              { id: 'current_week', label: 'Semaine en cours' },
              { id: 'current_month', label: 'Mois en cours' },
              { id: 'custom', label: 'Personnalisée' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                preset === item.id
                  ? 'bg-white dark:bg-[#1E293B] text-[#172D4D] dark:text-slate-100 shadow-sm'
                  : 'text-[#667085] dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs ml-auto">
          <input
            type="date"
            value={periodStart}
            onChange={(e) => {
              setPreset('custom');
              setPeriodStart(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
          />
          <span className="text-[#667085] dark:text-slate-400">au</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => {
              setPreset('custom');
              setPeriodEnd(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
          />
        </div>
      </div>

      {/* Formula Disclosure */}
      <div className="bg-[#EAF2FC] dark:bg-[#172A45] border border-[#3578C8]/25 dark:border-blue-500/30 rounded-lg px-4 py-3 text-xs text-[#172D4D] dark:text-slate-100">
        <strong>Méthode de calcul officielle :</strong> Taux de réalisation ={' '}
        <span className="font-mono-num">
          (Tâches attendues terminées dans la période / Tâches attendues dans la période) × 100
        </span>
        . Cet indicateur est distinct de la progression moyenne des tâches encore actives (
        <span className="font-mono-num">{totals.averageActiveProgress} %</span>).
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Taux de réalisation officiel"
          value={`${completionRate}%`}
          helper={`${totals.tasksCompletedInPeriod} terminées (${totals.tasksCompletedOnTime} à temps, ${totals.tasksCompletedLate} en retard)`}
          tone={completionRate >= 80 ? 'green' : completionRate >= 50 ? 'blue' : 'amber'}
        />
        <StatCard
          label="Tâches attendues / planifiées"
          value={totals.tasksExpectedInPeriod}
          helper={`${totals.tasksCreated} créées · ${totals.tasksPlanned} planifiées`}
        />
        <StatCard
          label="Tâches actives & en retard"
          value={totals.tasksActive}
          helper={`${totals.tasksOverdue} en retard · ${totals.tasksDeferred} reportées`}
          tone={totals.tasksOverdue > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Missions & validations"
          value={`${totals.approvedCount}/${totals.missionsReceived}`}
          helper={`${totals.missionsAccepted} acceptées · ${totals.missionsRejected} refusées · ${totals.submissionsCount} soumises`}
          tone="blue"
        />
      </div>

      {/* Collective Breakdown Table + Chart */}
      {scope === 'collective' && canSeeCollective && employeeBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5">
            <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100 mb-4">
              Comparaison du taux de réalisation par collaborateur (%)
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeBreakdown} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTickColor }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chartTickColor }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="completionRate"
                    name="Taux réalisation (%)"
                    fill={isDark ? '#60A5FA' : '#3578C8'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80">
              <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
                Répartition par collaborateur
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-[#F4F6FA] dark:bg-[#0F172A] text-xs text-[#667085] dark:text-slate-400">
                    <th className="py-2.5 px-4">Collaborateur</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Terminées</th>
                    <th className="py-2.5 px-3 text-right">En retard</th>
                    <th className="py-2.5 px-4 text-right">Taux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeeBreakdown.map((e) => (
                    <tr key={e.uid}>
                      <td className="py-2.5 px-4 font-medium text-[#172D4D] dark:text-slate-100">{e.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#172D4D] dark:text-slate-200">
                        {e.total}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#16A36A] dark:text-emerald-400">
                        {e.completed}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-[#DC4545] dark:text-red-400">
                        {e.overdue}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-bold text-[#172D4D] dark:text-slate-100">
                        {e.completionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Saved Reports Archive */}
      <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden no-print">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/80">
          <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
            Rapports archivés ({savedReports.length})
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Inclut les rapports hebdomadaires automatiques (générés chaque lundi à 06h00 Africa/Douala) et les sauvegardes manuelles.
          </p>
        </div>
        {savedReports.length === 0 ? (
          <div className="p-6 text-xs text-[#667085] dark:text-slate-400">
            Aucun rapport archivé pour le moment. Cliquez sur « Archiver » pour enregistrer la période en cours.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {savedReports.slice(0, 12).map((r) => (
              <div
                key={r.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#172D4D] dark:text-slate-100">
                    {r.type === 'collective' ? 'Rapport collectif' : `Individuel · ${r.employeeName || ''}`}
                  </span>
                  <span className="text-[#667085] dark:text-slate-400">
                    {' '}· Du {formatDateFR(r.periodStart)} au {formatDateFR(r.periodEnd)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono-num font-bold text-[#3578C8] dark:text-blue-400">
                    {r.completionRate}% réalisation
                  </span>
                  <span className="font-mono-num text-[#667085] dark:text-slate-400">
                    {formatTimestampFR(r.generatedAt)}
                  </span>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExportArchivedCSV(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-[#F4F6FA] dark:bg-[#0F172A] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-[#16A36A] dark:hover:text-emerald-400 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportArchivedPDF(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-[#F4F6FA] dark:bg-[#0F172A] hover:bg-[#EAF2FC] dark:hover:bg-[#172A45] hover:text-[#3578C8] dark:hover:text-blue-400 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDF
                    </button>
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
