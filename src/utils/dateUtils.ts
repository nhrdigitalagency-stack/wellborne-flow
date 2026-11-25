import type { Timestamp } from 'firebase/firestore';
import type { TaskStatus } from '../types';

export const DEFAULT_TIMEZONE = 'Africa/Douala';
export const DEFAULT_LOCALE = 'fr-FR';

/**
 * Retourne la date locale courante au format YYYY-MM-DD dans le fuseau Africa/Douala.
 */
export function getTodayDoualaISO(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Retourne l'heure courante HH:mm dans le fuseau Africa/Douala.
 */
export function getCurrentTimeDouala(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/**
 * Formate une date ISO YYYY-MM-DD en français lisible (ex: 24 nov. 2026).
 */
export function formatDateFR(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const normalized = isoDate.length === 10 ? `${isoDate}T12:00:00Z` : isoDate;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Formate un Timestamp Firestore ou une Date en date + heure Africa/Douala.
 */
export function formatTimestampFR(ts?: Timestamp | Date | null): string {
  if (!ts) return '—';
  const date = ts instanceof Date ? ts : typeof ts.toDate === 'function' ? ts.toDate() : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Convertit un Timestamp Firestore en YYYY-MM-DD dans Africa/Douala.
 */
export function timestampToDoualaISO(ts?: Timestamp | Date | null): string | null {
  if (!ts) return null;
  const date = ts instanceof Date ? ts : typeof ts.toDate === 'function' ? ts.toDate() : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return getTodayDoualaISO(date);
}

/**
 * Détermine automatiquement si une tâche est en retard selon la date locale Africa/Douala.
 * Les tâches terminées ou annulées ne sont jamais en retard.
 */
export function isTaskOverdue(
  dueAt: string | undefined | null,
  status: TaskStatus,
  todayISO: string = getTodayDoualaISO()
): boolean {
  if (!dueAt) return false;
  if (status === 'completed' || status === 'cancelled') return false;
  const dueDay = dueAt.slice(0, 10);
  return dueDay < todayISO;
}

/**
 * Détermine si une tâche est due aujourd'hui ou prévue aujourd'hui.
 */
export function isTaskScheduledForToday(
  plannedDate: string | undefined | null,
  dueAt: string | undefined | null,
  todayISO: string = getTodayDoualaISO()
): boolean {
  const planned = plannedDate?.slice(0, 10);
  const due = dueAt?.slice(0, 10);
  return planned === todayISO || due === todayISO;
}

/**
 * Calcule la plage de la semaine précédente (lundi -> dimanche) dans Africa/Douala.
 */
export function getPreviousWeekRangeDouala(reference: Date = new Date()): { start: string; end: string } {
  const todayISO = getTodayDoualaISO(reference);
  const [y, m, d] = todayISO.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay(); // 0=dim, 1=lun...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const prevMonday = new Date(utcDate);
  prevMonday.setUTCDate(utcDate.getUTCDate() - daysSinceMonday - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);

  return {
    start: prevMonday.toISOString().slice(0, 10),
    end: prevSunday.toISOString().slice(0, 10),
  };
}

/**
 * Calcule la plage de la semaine courante (lundi -> dimanche) dans Africa/Douala.
 */
export function getCurrentWeekRangeDouala(reference: Date = new Date()): { start: string; end: string } {
  const todayISO = getTodayDoualaISO(reference);
  const [y, m, d] = todayISO.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(utcDate);
  monday.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Calcule la plage du mois courant dans Africa/Douala.
 */
export function getCurrentMonthRangeDouala(reference: Date = new Date()): { start: string; end: string } {
  const todayISO = getTodayDoualaISO(reference);
  const [y, m] = todayISO.split('-').map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  return {
    start: firstDay.toISOString().slice(0, 10),
    end: lastDay.toISOString().slice(0, 10),
  };
}

/**
 * Ajoute N jours à une date YYYY-MM-DD.
 */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Retourne les 7 dates ISO (lundi..dimanche) de la semaine contenant `anchorISO`.
 */
export function getWeekDatesISO(anchorISO: string): string[] {
  const [y, m, d] = anchorISO.slice(0, 10).split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(utcDate);
  monday.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(monday);
    cur.setUTCDate(monday.getUTCDate() + i);
    return cur.toISOString().slice(0, 10);
  });
}

/**
 * Retourne la grille des jours d'un mois (lundi en début de semaine).
 */
export function getMonthGridISO(year: number, monthIndex0: number): { dateISO: string; inMonth: boolean }[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1));
  const dayOfWeek = firstOfMonth.getUTCDay();
  const leadingDays = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(firstOfMonth);
  start.setUTCDate(firstOfMonth.getUTCDate() - leadingDays);

  const cells: { dateISO: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(start);
    cur.setUTCDate(start.getUTCDate() + i);
    cells.push({
      dateISO: cur.toISOString().slice(0, 10),
      inMonth: cur.getUTCMonth() === monthIndex0,
    });
  }
  return cells;
}
