import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRouteForRole } from '../../routes/ProtectedRoute';
import {
  logoutUser,
  resendVerificationEmail,
  translateFirebaseAuthError,
} from '../../services/auth/authService';
import { AuthShell } from './AuthShell';

export function VerifyEmailPage() {
  const { firebaseUser, profile, refreshAuthUser } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      await resendVerificationEmail();
      setMessage('Un nouvel e-mail de vérification a été envoyé à votre adresse.');
    } catch (err) {
      setError(translateFirebaseAuthError(err));
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    setError(null);
    setChecking(true);
    try {
      await refreshAuthUser();
      if (firebaseUser?.emailVerified) {
        if (profile?.accountStatus === 'active') {
          navigate(getDefaultRouteForRole(profile.role), { replace: true });
        } else {
          navigate('/compte-en-attente', { replace: true });
        }
      } else {
        setMessage('Votre adresse e-mail n’est pas encore confirmée. Cliquez sur le lien reçu puis réessayez.');
      }
    } catch (err) {
      setError(translateFirebaseAuthError(err));
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/connexion', { replace: true });
  };

  return (
    <AuthShell
      title="Vérifiez votre adresse e-mail"
      subtitle="Pour sécuriser les données de l’entreprise, votre adresse e-mail doit être confirmée avant d’accéder à WELLBORNE FLOW."
    >
      <div className="flex items-center gap-3 p-4 rounded-lg bg-[#EAF2FC] dark:bg-[#172A45] text-[#172D4D] dark:text-slate-100 mb-5">
        <Mail className="w-5 h-5 text-[#3578C8] dark:text-blue-400 shrink-0" />
        <p className="text-sm">
          Lien envoyé à <strong>{firebaseUser?.email || 'votre adresse'}</strong>.
        </p>
      </div>

      {message && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-3 text-xs text-[#172D4D] dark:text-slate-200">
          <CheckCircle2 className="w-4 h-4 text-[#16A36A] dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg p-3 text-xs text-[#DC4545] dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="w-full py-2.5 px-4 bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          <span>J’ai confirmé mon adresse e-mail</span>
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="w-full py-2.5 px-4 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-[#172D4D] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium rounded-lg cursor-pointer disabled:opacity-50"
        >
          {sending ? 'Envoi en cours…' : 'Renvoyer l’e-mail de vérification'}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2 text-xs text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 cursor-pointer"
        >
          Se déconnecter et utiliser un autre compte
        </button>
      </div>
    </AuthShell>
  );
}
