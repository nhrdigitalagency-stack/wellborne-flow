import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, isBootstrapAdmin } = useAuth();

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
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const isAuthorizedActive = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      profile &&
      profile.accountStatus === 'active'
  );

  const isManagerOrAdmin = Boolean(
    profile && (profile.role === 'manager' || profile.role === 'admin')
  );

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
      setDataReady(false);
      return;
    }

    const uid = profile.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeMyTasks(uid, (items) => {
        setMyTasks(items);
        setDataReady(true);
      })
    );
    unsubs.push(subscribePublishedTasks(setPublishedTasks));
    unsubs.push(subscribeTaskLabels(setTaskLabels));
    unsubs.push(subscribeTeamDirectory(setTeamDirectory));
    unsubs.push(subscribeMyAssignments(uid, setMyAssignments));
    unsubs.push(subscribeEmployeeMissions(uid, setEmployeeMissions));
    unsubs.push(subscribeUserNotifications(uid, setNotifications));
    unsubs.push(subscribeAuditLogs(uid, isBootstrapAdmin, setAuditLogs));
    unsubs.push(subscribeSavedReports(uid, isBootstrapAdmin, isManagerOrAdmin, setSavedReports));

    if (isManagerOrAdmin) {
      unsubs.push(subscribeManagedAssignments(uid, isBootstrapAdmin, setManagedAssignments));
      unsubs.push(subscribeManagedMissions(uid, isBootstrapAdmin, setManagedMissions));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isAuthorizedActive, profile?.uid, profile?.role, isBootstrapAdmin, isManagerOrAdmin]);

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
