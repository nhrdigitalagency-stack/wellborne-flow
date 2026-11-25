import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { updateOrganizationSettings } from '../../services/auth/authService';
import { runManualDailyReminders } from '../../services/notifications/notificationService';

export function AdminSettingsPage() {
  const { profile, orgSettings } = useAuth();
  const { publishedTasks, myTasks, teamDirectory } = useWorkspace();
  const { showToast } = useToast();

  const [companyName, setCompanyName] = useState(orgSettings.companyName);
  const [timezone, setTimezone] = useState(orgSettings.timezone);
  const [reminderTime, setReminderTime] = useState(orgSettings.reminderTime);
  const [requireAdminActivation, setRequireAdminActivation] = useState(
    orgSettings.requireAdminActivation
  );
  const [requirePersonalTaskApproval, setRequirePersonalTaskApproval] = useState(
    orgSettings.requirePersonalTaskApproval
  );
  const [weeklyReportDay, setWeeklyReportDay] = useState<'monday' | 'sunday'>(
    orgSettings.weeklyReportDay
  );
  const [weeklyReportTime, setWeeklyReportTime] = useState(orgSettings.weeklyReportTime);
  const [saving, setSaving] = useState(false);
  const [runningReminder, setRunningReminder] = useState(false);

  useEffect(() => {
    setCompanyName(orgSettings.companyName);
    setTimezone(orgSettings.timezone);
    setReminderTime(orgSettings.reminderTime);
    setRequireAdminActivation(orgSettings.requireAdminActivation);
    setRequirePersonalTaskApproval(orgSettings.requirePersonalTaskApproval);
    setWeeklyReportDay(orgSettings.weeklyReportDay);
    setWeeklyReportTime(orgSettings.weeklyReportTime);
  }, [orgSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await updateOrganizationSettings(profile, {
        companyName,
        timezone,
        reminderTime,
        requireAdminActivation,
        requirePersonalTaskApproval,
        weeklyReportDay,
        weeklyReportTime,
      });
      showToast('Paramètres globaux de l’entreprise enregistrés.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur d’enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminder(true);
    try {
      const mergedMap = new Map(publishedTasks.map((t) => [t.id, t]));
      myTasks.forEach((t) => mergedMap.set(t.id, t));
      const usersMap = new Map(
        teamDirectory.map((u) => [
          u.uid,
          { firstName: u.firstName, accountStatus: u.accountStatus },
        ])
      );
      const res = await runManualDailyReminders(Array.from(mergedMap.values()), usersMap);
      showToast(
        `Rappel exécuté : ${res.sentUsers} collaborateur(s) notifié(s), ${res.reminderTasksCount} tâche(s) rappelée(s), ${res.skippedDuplicates} doublon(s) évité(s).`,
        'info'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur d’exécution des rappels', 'error');
    } finally {
      setRunningReminder(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
          Paramètres généraux de l’entreprise
        </h1>
        <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
          Configurez l’heure des rappels quotidiens, la génération des rapports hebdomadaires et le contrôle d’activation des comptes.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="org-name" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Nom de l’entreprise *
            </label>
            <input
              id="org-name"
              type="text"
              required
              maxLength={120}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="org-tz" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Fuseau horaire de référence
            </label>
            <input
              id="org-tz"
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label htmlFor="org-rem" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Heure du rappel quotidien
            </label>
            <input
              id="org-rem"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="org-rep-day" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Jour rapport hebdomadaire
            </label>
            <select
              id="org-rep-day"
              value={weeklyReportDay}
              onChange={(e) => setWeeklyReportDay(e.target.value as 'monday' | 'sunday')}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
            >
              <option value="monday">Lundi</option>
              <option value="sunday">Dimanche</option>
            </select>
          </div>
          <div>
            <label htmlFor="org-rep-time" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Heure rapport hebdomadaire
            </label>
            <input
              id="org-rep-time"
              type="time"
              value={weeklyReportTime}
              onChange={(e) => setWeeklyReportTime(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <label className="flex items-start gap-3 text-sm text-[#172D4D] dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={requireAdminActivation}
              onChange={(e) => setRequireAdminActivation(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#3578C8]"
            />
            <span>
              <strong>Exiger l’activation administrateur</strong> pour les nouvelles inscriptions
              publiques avant l’accès à l’espace commun (recommandé).
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-[#172D4D] dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={requirePersonalTaskApproval}
              onChange={(e) => setRequirePersonalTaskApproval(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#3578C8]"
            />
            <span>
              Exiger une validation hiérarchique pour les tâches personnelles (les missions attribuées exigent toujours une validation).
            </span>
          </label>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer les paramètres
          </button>
        </div>
      </form>

      {/* Manual idempotent daily reminder trigger */}
      <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
          <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
            Rappels quotidiens automatisés (20h00 Africa/Douala)
          </h2>
        </div>
        <p className="text-xs text-[#667085] dark:text-slate-400 leading-relaxed">
          La fonction Cloud Functions v2 planifiée (<code className="font-mono-num">functions/src/reminders/dailyReminder.ts</code>)
          exécute ce contrôle automatiquement à l’heure configurée même si aucun collaborateur n’est connecté.
          Vous pouvez également déclencher un cycle manuel idempotent ci-dessous (protégé par la collection{' '}
          <code className="font-mono-num">reminderDeliveries</code> pour garantir zéro doublon par jour).
        </p>
        <button
          type="button"
          disabled={runningReminder}
          onClick={handleRunReminders}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#EAF2FC] dark:bg-[#172A45] text-[#172D4D] dark:text-slate-100 border border-[#3578C8]/30 dark:border-blue-500/40 rounded-lg hover:bg-[#dcebfa] dark:hover:bg-[#1e3658] cursor-pointer disabled:opacity-50"
        >
          {runningReminder && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Déclencher un contrôle de rappel quotidien maintenant
        </button>
      </section>
    </div>
  );
}
