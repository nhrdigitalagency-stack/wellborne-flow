import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { TaskPriority, TaskStatus } from '../../types';
import {
  PRIORITY_LABELS,
  PRIORITY_TEXT_CLASS,
  STATUS_LABELS,
  STATUS_TEXT_CLASS,
} from '../../utils/taskUtils';

/**
 * Indicateur de statut typographique sobre (jamais couleur seule : texte explicite + accent mesuré).
 */
export function StatusLabel({ status, overdue = false }: { status: TaskStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span className={STATUS_TEXT_CLASS[status]}>{STATUS_LABELS[status]}</span>
      {overdue && (
        <>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-[#DC4545] dark:text-red-400 font-semibold">En retard</span>
        </>
      )}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`text-xs whitespace-nowrap ${PRIORITY_TEXT_CLASS[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function ProgressBar({
  value,
  overdue = false,
  showLabel = true,
}: {
  value: number;
  overdue?: boolean;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const fillColor =
    pct === 100
      ? 'bg-[#16A36A] dark:bg-emerald-500'
      : overdue
      ? 'bg-[#DC4545] dark:bg-red-500'
      : 'bg-[#3578C8] dark:bg-blue-500';

  return (
    <div className="flex items-center gap-2.5 min-w-[96px]">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${fillColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono-num text-[#172D4D] dark:text-slate-200 w-9 text-right shrink-0">
          {pct}%
        </span>
      )}
    </div>
  );
}

export function UserAvatar({
  firstName,
  lastName,
  photoURL,
  size = 'md',
}: {
  firstName?: string;
  lastName?: string;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const initials = `${(firstName || 'U').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
  const dims =
    size === 'sm'
      ? 'w-7 h-7 text-xs'
      : size === 'lg'
      ? 'w-14 h-14 text-lg'
      : 'w-9 h-9 text-xs';

  if (photoURL && !imgFailed) {
    return (
      <img
        src={photoURL}
        alt={`${firstName || ''} ${lastName || ''}`.trim() || 'Avatar utilisateur'}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${dims} rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-full bg-[#EAF2FC] dark:bg-[#1E3A5F] text-[#172D4D] dark:text-blue-100 font-semibold flex items-center justify-center border border-[#3578C8]/20 dark:border-blue-400/30 shrink-0`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: number | string;
  helper?: string;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red';
  onClick?: () => void;
}) {
  const valueTone =
    tone === 'blue'
      ? 'text-[#3578C8] dark:text-blue-400'
      : tone === 'green'
      ? 'text-[#16A36A] dark:text-emerald-400'
      : tone === 'amber'
      ? 'text-[#D97706] dark:text-amber-400'
      : tone === 'red'
      ? 'text-[#DC4545] dark:text-red-400'
      : 'text-[#172D4D] dark:text-slate-100';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left w-full bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 transition-colors ${
        onClick ? 'hover:border-[#3578C8] dark:hover:border-blue-400 cursor-pointer' : ''
      }`}
    >
      <p className="text-xs font-medium text-[#667085] dark:text-slate-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono-num tracking-tight ${valueTone}`}>{value}</p>
      {helper && <p className="text-xs text-[#667085] dark:text-slate-400 mt-1.5">{helper}</p>}
    </Tag>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-[#172D4D] dark:text-slate-100 mb-1.5">{title}</h3>
      <p className="text-sm text-[#667085] dark:text-slate-400 max-w-md mx-auto mb-5">{description}</p>
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-24" />
            <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172D4D]/40 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/80">
          <h2 id="modal-title" className="text-base font-bold text-[#172D4D] dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="p-1.5 text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} maxWidth="max-w-md">
      <div className="flex items-start gap-3 mb-5">
        {danger && <AlertTriangle className="w-5 h-5 text-[#DC4545] dark:text-red-400 shrink-0 mt-0.5" />}
        <p className="text-sm text-[#667085] dark:text-slate-300 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
            danger ? 'bg-[#DC4545] hover:bg-[#b91c1c]' : 'bg-[#3578C8] hover:bg-[#2a63a8]'
          }`}
        >
          {loading ? 'Traitement…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
