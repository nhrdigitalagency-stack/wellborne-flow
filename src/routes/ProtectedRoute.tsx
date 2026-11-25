import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export function getDefaultRouteForRole(role?: UserRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/responsable';
  return '/tableau-de-bord';
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { firebaseUser, emailVerified, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0B1320] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-xl px-8 py-6 text-center">
          <div className="w-8 h-8 rounded-lg bg-[#172D4D] dark:bg-[#3578C8] text-white font-display font-bold text-xs flex items-center justify-center mx-auto mb-3">
            WF
          </div>
          <p className="text-sm font-medium text-[#172D4D] dark:text-slate-100">
            Chargement de votre espace WELLBORNE FLOW…
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/connexion" replace />;
  }

  if (!emailVerified) {
    return <Navigate to="/verification-email" replace />;
  }

  if (!profile || profile.accountStatus !== 'active') {
    return <Navigate to="/compte-en-attente" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={getDefaultRouteForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}
