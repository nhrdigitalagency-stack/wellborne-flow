import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, ExternalLink } from 'lucide-react';
import { EmptyState, TableSkeleton } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getDevicePushStatus,
  markAllNotificationsRead,
  markNotificationRead,
  registerBrowserPushPreference,
} from '../../services/notifications/notificationService';
import type { AppNotification } from '../../types';
import { formatTimestampFR } from '../../utils/dateUtils';

export function NotificationsPage() {
  const { firebaseUser, profile } = useAuth();
  const { notifications, unreadCount, dataReady } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!firebaseUser?.emailVerified || !profile || profile.accountStatus !== 'active') return;
    let cancelled = false;
    getDevicePushStatus(profile.uid)
      .then((token) => {
        if (!cancelled) setPushEnabled(Boolean(token?.enabled));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.emailVerified, profile?.uid, profile?.accountStatus]);

  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications),
    [notifications, filter]
  );

  const handleOpenNotification = async (notif: AppNotification) => {
    if (!notif.readAt) {
      await markNotificationRead(notif.id).catch(() => undefined);
    }
    if (notif.entityType === 'task' && notif.entityId) {
      navigate(`/taches/${notif.entityId}`);
    } else if (notif.entityType === 'assignment') {
      navigate(notif.type === 'work_submitted' ? '/validations' : '/mes-missions');
    } else if (notif.entityType === 'mission') {
      navigate(profile?.role === 'employee' ? '/mes-missions' : '/toutes-les-missions');
    } else if (notif.entityType === 'report') {
      navigate('/mes-rapports');
    }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead(notifications);
    showToast('Toutes les notifications ont été marquées comme lues.');
  };

  const handleTogglePush = async () => {
    if (!profile) return;
    setPushLoading(true);
    try {
      const res = await registerBrowserPushPreference(profile.uid, !pushEnabled);
      if (res.status === 'granted') {
        setPushEnabled(true);
        showToast('Notifications push navigateur activées et appareil enregistré.');
      } else if (res.status === 'disabled') {
        setPushEnabled(false);
        showToast('Notifications push désactivées pour cet appareil.', 'info');
      } else if (res.status === 'denied') {
        setPushEnabled(false);
        showToast(
          'Autorisation bloquée par le navigateur. Autorisez les notifications dans les réglages du navigateur.',
          'error'
        );
      } else {
        showToast('Ce navigateur ne prend pas en charge les notifications push.', 'info');
      }
    } finally {
      setPushLoading(false);
    }
  };

  if (!dataReady) return <TableSkeleton rows={5} />;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Centre de notifications
          </h1>
          <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
            {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}{' '}
            · Rappels quotidiens programmés à 20h00 (Africa/Douala)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={pushLoading}
            onClick={handleTogglePush}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
              pushEnabled
                ? 'bg-[#EAF2FC] dark:bg-[#172A45] border-[#3578C8]/30 dark:border-blue-500/40 text-[#172D4D] dark:text-slate-100'
                : 'bg-white dark:bg-[#111C2E] border-slate-200 dark:border-slate-700 text-[#172D4D] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 text-[#3578C8] dark:text-blue-400" />
            {pushEnabled ? 'Push navigateur actif' : 'Activer Push navigateur'}
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      <div className="inline-flex items-center bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            filter === 'all'
              ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
              : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
          }`}
        >
          Toutes ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            filter === 'unread'
              ? 'bg-[#172D4D] dark:bg-[#3578C8] text-white'
              : 'text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100'
          }`}
        >
          Non lues ({unreadCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune notification"
          description={
            filter === 'unread'
              ? 'Toutes vos notifications ont été consultées.'
              : 'Les attributions de missions, validations, commentaires et rappels quotidiens apparaîtront ici.'
          }
        />
      ) : (
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((n) => {
            const unread = !n.readAt;
            return (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                  unread ? 'bg-[#EAF2FC]/45 dark:bg-[#172A45]/60' : 'bg-white dark:bg-[#111C2E]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Bell
                    className={`w-4 h-4 shrink-0 mt-1 ${
                      unread
                        ? 'text-[#3578C8] dark:text-blue-400'
                        : 'text-[#667085] dark:text-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100">{n.title}</p>
                      {unread && (
                        <span className="text-[11px] font-semibold text-[#3578C8] dark:text-blue-400">
                          Non lue
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#667085] dark:text-slate-300 whitespace-pre-line mt-1 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400 mt-2">
                      {formatTimestampFR(n.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {unread && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                    >
                      Lu
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(n)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg hover:border-[#3578C8] hover:text-[#3578C8] dark:hover:border-blue-400 dark:hover:text-blue-400 cursor-pointer"
                  >
                    Ouvrir
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
