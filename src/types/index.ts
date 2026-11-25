import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'employee' | 'manager' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended';

export interface NotificationPreferences {
  inApp: boolean;
  dailyReminder: boolean;
  webPush: boolean;
  missionEvents: boolean;
  commentEvents: boolean;
}

export interface UserPrivate {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  position?: string;
  department?: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  photoURL?: string;
  timezone: string;
  notificationPreferences: NotificationPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPublic {
  uid: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  position?: string;
  department?: string;
  accountStatus: AccountStatus;
  photoURL?: string;
  workspaceVisibility: 'company';
  updatedAt: Timestamp;
}

export interface OrganizationSettings {
  companyName: string;
  timezone: string;
  reminderTime: string;
  requireAdminActivation: boolean;
  requirePersonalTaskApproval: boolean;
  weeklyReportDay: 'monday' | 'sunday';
  weeklyReportTime: string;
  updatedBy: string;
  updatedAt: Timestamp;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'submitted'
  | 'changes_requested'
  | 'completed'
  | 'cancelled';

export type PublicationStatus = 'draft' | 'published';
export type TaskSource = 'personal' | 'mission';
export type ProgressMode = 'auto' | 'manual';

export type TaskLabelGroup = 'priority' | 'department' | 'project_type';
export type TaskLabelColor = 'blue' | 'navy' | 'green' | 'amber' | 'red' | 'teal' | 'slate';

export interface TaskLabel {
  id: string;
  name: string;
  group: TaskLabelGroup;
  color: TaskLabelColor;
  workspaceVisibility: 'company';
  createdBy: string;
  creatorName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  creatorName: string;
  ownerId: string;
  ownerName: string;
  source: TaskSource;
  missionId?: string | null;
  assignmentId?: string | null;
  startAt: string; // YYYY-MM-DD
  plannedDate: string; // YYYY-MM-DD
  dueAt: string; // YYYY-MM-DD
  priority: TaskPriority;
  category: string;
  labelIds?: string[];
  status: TaskStatus;
  publicationStatus: PublicationStatus;
  progressMode: ProgressMode;
  progress: number;
  subtaskCount: number;
  completedSubtaskCount: number;
  completedAt?: Timestamp | null;
  deletedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Subtask {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  completed: boolean;
  completedBy?: string | null;
  completedAt?: Timestamp | null;
  ownerId: string;
  publicationStatus: PublicationStatus;
  createdAt: Timestamp;
}

export type MissionStatus = 'draft' | 'published' | 'closed' | 'cancelled';

export interface Mission {
  id: string;
  title: string;
  description: string;
  objectives: string;
  instructions: string;
  createdBy: string;
  creatorName: string;
  startAt: string;
  dueAt: string;
  priority: TaskPriority;
  status: MissionStatus;
  category: string;
  checklistTemplate: string[];
  assignedEmployeeIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AcceptanceStatus = 'pending' | 'accepted' | 'rejected';
export type WorkStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'submitted'
  | 'changes_requested'
  | 'approved';

export interface MissionAssignment {
  id: string;
  missionId: string;
  missionTitle: string;
  employeeId: string;
  employeeName: string;
  assignedBy: string;
  assignedByName: string;
  acceptanceStatus: AcceptanceStatus;
  workStatus: WorkStatus;
  taskId?: string | null;
  progress: number;
  priority: TaskPriority;
  startAt: string;
  dueAt: string;
  acceptedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  rejectionReason?: string | null;
  submittedAt?: Timestamp | null;
  submissionNote?: string | null;
  reviewedAt?: Timestamp | null;
  reviewComment?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NotificationType =
  | 'mission_assigned'
  | 'mission_accepted'
  | 'mission_rejected'
  | 'task_due_soon'
  | 'task_overdue'
  | 'comment_added'
  | 'work_submitted'
  | 'work_approved'
  | 'changes_requested'
  | 'daily_reminder'
  | 'account_activated';

export interface AppNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: 'task' | 'mission' | 'assignment' | 'report' | 'account';
  entityId: string;
  readAt?: Timestamp | null;
  createdAt: Timestamp;
}

export interface TaskComment {
  id: string;
  taskId?: string | null;
  missionId?: string | null;
  authorId: string;
  authorName: string;
  content: string;
  visibility: 'company' | 'private';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeviceToken {
  userId: string;
  installationId: string;
  platform: string;
  token?: string | null;
  enabled: boolean;
  updatedAt: Timestamp;
}

export interface ReportTotals {
  tasksCreated: number;
  tasksPlanned: number;
  tasksExpectedInPeriod: number;
  tasksCompletedInPeriod: number;
  tasksCompletedOnTime: number;
  tasksCompletedLate: number;
  tasksActive: number;
  tasksOverdue: number;
  tasksDeferred: number;
  missionsReceived: number;
  missionsAccepted: number;
  missionsRejected: number;
  submissionsCount: number;
  approvedCount: number;
  averageActiveProgress: number;
}

export interface ActivityReport {
  id: string;
  type: 'individual' | 'collective';
  periodKind: 'weekly' | 'monthly' | 'custom';
  employeeId?: string | null;
  employeeName?: string | null;
  periodStart: string;
  periodEnd: string;
  totals: ReportTotals;
  completionRate: number;
  generatedBy: string;
  generatedAt: Timestamp;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  action: string;
  entityType:
    | 'user'
    | 'task'
    | 'subtask'
    | 'mission'
    | 'assignment'
    | 'report'
    | 'settings'
    | 'reminder'
    | 'label';
  entityId: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}
