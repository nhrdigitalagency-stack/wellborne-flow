import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeAuditLogs } from '../services/audit/auditService';
import { subscribeTeamDirectory } from '../services/auth/authService';
import {
  subscribeEmployeeMissions,
  subscribeManagedAssignments,
  subscribeManagedMissions,
  subscribeMyAssignments,
} from '../services/missions/missionService';
import { subscribeUserNotifications } from '../services/notifications/notificationService';
import { subscribeSavedReports } from '../services/reports/reportService';
import { subscribeTaskLabels } from '../services/tasks/labelService';
import { subscribeMyTasks, subscribePublishedTasks } from '../services/tasks/taskService';
import type {
  ActivityReport,
  AppNotification,
  AuditLog,
  Mission,
  MissionAssignment,
  Task,
  TaskLabel,
  UserPublic,
} from '../types';
import { useAuth } from './AuthContext';

interface WorkspaceContextValue {
  myTasks: Task[];
  publishedTasks: Task[];
  taskLabels: TaskLabel[];
  taskLabelMap: Map<string, TaskLabel>;
  teamDirectory: UserPublic[];
  myAssignments: MissionAssignment[];
  managedAssignments: MissionAssignment[];
  managedMissions: Mission[];
  employeeMissions: Mission[];
  notifications: AppNotification[];
  unreadCount: number;
  auditLogs: AuditLog[];
  savedReports: ActivityReport[];
  dataReady: boolean;
  syncError: string | null;
  retrySync: () => Promise<void>;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'permission-denied') return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.toLowerCase().includes('permission');
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, emailVerified, tokenReady, profile, isBootstrapAdmin, refreshAuthUser } =
    useAuth();

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [publishedTasks, setPublishedTasks] = useState<Task[]>([]);
  const [taskLabels, setTaskLabels] = useState<TaskLabel[]>([]);
  const [teamDirectory, setTeamDirectory] = useState<UserPublic[]>([]);
  const [myAssignments, setMyAssignments] = useState<MissionAssignment[]>([]);
  const [managedAssignments, setManagedAssignments] = useState<MissionAssignment[]>([]);
  const [managedMissions, setManagedMissions] = useState<Mission[]>([]);
  const [employeeMissions, setEmployeeMissions] = useState<Mission[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [savedReports, setSavedReports] = useState<ActivityReport[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const tokenRecoveryAttemptedRef = useRef(false);

  const isAuthorizedActive = Boolean(
    firebaseUser &&
      emailVerified &&
      tokenReady &&
      profile &&
      profile.accountStatus === 'active'
  );

  const isManagerOrAdmin = Boolean(
    profile && (profile.role === 'manager' || profile.role === 'admin')
  );

  useEffect(() => {
    tokenRecoveryAttemptedRef.current = false;
  }, [profile?.uid]);

  const retrySync = useCallback(async () => {
    setSyncError(null);
    setDataReady(false);
    tokenRecoveryAttemptedRef.current = false;
    try {
      await refreshAuthUser();
    } catch {
      // Poursuivre la reconnexion même si le refresh échoue
    }
    setSyncEpoch((n) => n + 1);
  }, [refreshAuthUser]);

  useEffect(() => {
    if (!isAuthorizedActive || !profile) {
      setMyTasks([]);
      setPublishedTasks([]);
      setTaskLabels([]);
      setTeamDirectory([]);
      setMyAssignments([]);
      setManagedAssignments([]);
      setManagedMissions([]);
      setEmployeeMissions([]);
      setNotifications([]);
      setAuditLogs([]);
      setSavedReports([]);
      setGlobalSearchQuery('');
      setSyncError(null);
      setDataReady(false);
      return;
    }

    const uid = profile.uid;
    let active = true;
    const unsubs: Array<() => void> = [];

    const markReady = () => {
      if (active) setDataReady(true);
    };

    const handleListenerError = (source: string) => (error: unknown) => {
      if (!active) return;

      // Auto-réparation : si le jeton JWT vient tout juste d'être vérifié, forcer un renouvellement une fois
      if (isPermissionDeniedError(error) && firebaseUser && !tokenRecoveryAttemptedRef.current) {
        tokenRecoveryAttemptedRef.current = true;
        firebaseUser
          .getIdToken(true)
          .then(() => {
            if (active) {
              setSyncEpoch((n) => n + 1);
            }
          })
          .catch(() => {
            if (active) {
              setSyncError(
                'La synchronisation Firestore a rencontré une erreur d’autorisation. Cliquez sur « Réessayer » ou reconnectez-vous.'
              );
              setDataReady(true);
            }
          });
        return;
      }

      if (source === 'myTasks') {
        setSyncError(
          'Certaines données n’ont pas pu être synchronisées avec Firestore. Vérifiez votre connexion ou cliquez sur « Réessayer ».'
        );
      }
      // Ne JAMAIS bloquer l'interface sur un écran de chargement infini
      setDataReady(true);
    };

    // Filet de sécurité anti-chargement infini (4s max avant d'afficher l'interface)
    const readyTimeout = window.setTimeout(() => {
      if (active) setDataReady(true);
    }, 4000);

    unsubs.push(
      subscribeMyTasks(
        uid,
        (items) => {
          if (!active) return;
          setMyTasks(items);
          setSyncError(null);
          markReady();
        },
        handleListenerError('myTasks')
      )
    );
    unsubs.push(
      subscribePublishedTasks(
        (items) => {
          if (!active) return;
          setPublishedTasks(items);
          markReady();
        },
        handleListenerError('publishedTasks')
      )
    );
    unsubs.push(
      subscribeTaskLabels(
        (items) => {
          if (active) setTaskLabels(items);
        },
        handleListenerError('taskLabels')
      )
    );
    unsubs.push(
      subscribeTeamDirectory(
        (items) => {
          if (active) setTeamDirectory(items);
        },
        handleListenerError('teamDirectory')
      )
    );
    unsubs.push(
      subscribeMyAssignments(
        uid,
        (items) => {
          if (active) setMyAssignments(items);
        },
        handleListenerError('myAssignments')
      )
    );
    unsubs.push(
      subscribeEmployeeMissions(
        uid,
        (items) => {
          if (active) setEmployeeMissions(items);
        },
        handleListenerError('employeeMissions')
      )
    );
    unsubs.push(
      subscribeUserNotifications(
        uid,
        (items) => {
          if (active) setNotifications(items);
        },
        handleListenerError('notifications')
      )
    );
    unsubs.push(
      subscribeAuditLogs(
        uid,
        isBootstrapAdmin,
        (items) => {
          if (active) setAuditLogs(items);
        },
        handleListenerError('auditLogs')
      )
    );
    unsubs.push(
      subscribeSavedReports(
        uid,
        isBootstrapAdmin,
        isManagerOrAdmin,
        (items) => {
          if (active) setSavedReports(items);
        },
        handleListenerError('savedReports')
      )
    );

    if (isManagerOrAdmin) {
      unsubs.push(
        subscribeManagedAssignments(
          uid,
          isBootstrapAdmin,
          (items) => {
            if (active) setManagedAssignments(items);
          },
          handleListenerError('managedAssignments')
        )
      );
      unsubs.push(
        subscribeManagedMissions(
          uid,
          isBootstrapAdmin,
          (items) => {
            if (active) setManagedMissions(items);
          },
          handleListenerError('managedMissions')
        )
      );
    }

    return () => {
      active = false;
      window.clearTimeout(readyTimeout);
      unsubs.forEach((u) => u());
    };
  }, [
    isAuthorizedActive,
    firebaseUser,
    profile?.uid,
    profile?.role,
    isBootstrapAdmin,
    isManagerOrAdmin,
    syncEpoch,
  ]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications]
  );

  const taskLabelMap = useMemo(
    () => new Map(taskLabels.map((l) => [l.id, l])),
    [taskLabels]
  );

  const value = useMemo(
    () => ({
      myTasks,
      publishedTasks,
      taskLabels,
      taskLabelMap,
      teamDirectory,
      myAssignments,
      managedAssignments,
      managedMissions,
      employeeMissions,
      notifications,
      unreadCount,
      auditLogs,
      savedReports,
      dataReady,
      syncError,
      retrySync,
      globalSearchQuery,
      setGlobalSearchQuery,
    }),
    [
      myTasks,
      publishedTasks,
      taskLabels,
      taskLabelMap,
      teamDirectory,
      myAssignments,
      managedAssignments,
      managedMissions,
      employeeMissions,
      notifications,
      unreadCount,
      auditLogs,
      savedReports,
      dataReady,
      syncError,
      retrySync,
      globalSearchQuery,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace doit être utilisé dans un WorkspaceProvider.');
  }
  return ctx;
}
