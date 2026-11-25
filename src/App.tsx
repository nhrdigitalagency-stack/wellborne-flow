/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { PendingAccountPage } from './pages/auth/PendingAccountPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { CalendarPage } from './pages/employee/CalendarPage';
import { CreateTaskPage } from './pages/employee/CreateTaskPage';
import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage';
import { MyMissionsPage } from './pages/employee/MyMissionsPage';
import { MyTasksPage } from './pages/employee/MyTasksPage';
import { NotificationsPage } from './pages/employee/NotificationsPage';
import { ProfileSettingsPage } from './pages/employee/ProfileSettingsPage';
import { ReportsPage } from './pages/employee/ReportsPage';
import { SharedWorkspacePage } from './pages/employee/SharedWorkspacePage';
import { TaskDetailPage } from './pages/employee/TaskDetailPage';
import { AllMissionsPage } from './pages/manager/AllMissionsPage';
import { CreateMissionPage } from './pages/manager/CreateMissionPage';
import { EmployeesDirectoryPage } from './pages/manager/EmployeesDirectoryPage';
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { ValidationsPage } from './pages/manager/ValidationsPage';
import { getDefaultRouteForRole, ProtectedRoute } from './routes/ProtectedRoute';

function HomeRedirect() {
  const { firebaseUser, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0B1320] flex items-center justify-center">
        <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100">
          Chargement de WELLBORNE FLOW…
        </p>
      </div>
    );
  }
  if (!firebaseUser) return <Navigate to="/connexion" replace />;
  if (!firebaseUser.emailVerified) return <Navigate to="/verification-email" replace />;
  if (!profile || profile.accountStatus !== 'active') {
    return <Navigate to="/compte-en-attente" replace />;
  }
  return <Navigate to={getDefaultRouteForRole(profile.role)} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <ToastProvider>
                <Routes>
                {/* Public Auth Routes */}
                <Route path="/connexion" element={<LoginPage />} />
                <Route path="/inscription" element={<RegisterPage />} />
                <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
                <Route path="/verification-email" element={<VerifyEmailPage />} />
                <Route path="/compte-en-attente" element={<PendingAccountPage />} />

                {/* Authenticated App Routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Employee Workspace */}
                  <Route path="/tableau-de-bord" element={<EmployeeDashboardPage />} />
                  <Route path="/mes-taches" element={<MyTasksPage />} />
                  <Route path="/taches/nouvelle" element={<CreateTaskPage />} />
                  <Route path="/taches/:taskId" element={<TaskDetailPage />} />
                  <Route path="/espace-commun" element={<SharedWorkspacePage />} />
                  <Route path="/mes-missions" element={<MyMissionsPage />} />
                  <Route path="/planning" element={<CalendarPage teamMode={false} />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/mes-rapports" element={<ReportsPage allowCollective={false} />} />
                  <Route path="/profil" element={<ProfileSettingsPage initialTab="profile" />} />
                  <Route path="/parametres" element={<ProfileSettingsPage initialTab="preferences" />} />

                  {/* Manager Workspace */}
                  <Route
                    path="/responsable"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <ManagerDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/toutes-les-taches"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <SharedWorkspacePage
                          title="Toutes les tâches publiées de l’entreprise"
                          subtitle="Supervision globale des tâches en cours, terminées et en retard sur l’ensemble des équipes."
                        />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/missions/nouvelle"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <CreateMissionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/toutes-les-missions"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <AllMissionsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/validations"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <ValidationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/employes"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <EmployeesDirectoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/planning-equipe"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <CalendarPage teamMode />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/rapports"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <ReportsPage allowCollective />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/historique"
                    element={
                      <ProtectedRoute allowedRoles={['manager', 'admin']}>
                        <AuditLogsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin Workspace */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/utilisateurs"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminUsersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/parametres"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminSettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/securite"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AuditLogsPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="/" element={<HomeRedirect />} />
                <Route path="*" element={<HomeRedirect />} />
                </Routes>
              </ToastProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
