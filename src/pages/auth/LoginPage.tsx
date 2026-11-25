import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRouteForRole } from '../../routes/ProtectedRoute';
import {
  loginWithEmail,
  loginWithGoogle,
  translateFirebaseAuthError,
} from '../../services/auth/authService';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { firebaseUser, emailVerified, profile, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !firebaseUser) return;
    if (!emailVerified) {
      navigate('/verification-email', { replace: true });
      return;
    }
    if (profile) {
      if (profile.accountStatus !== 'active') {
        navigate('/compte-en-attente', { replace: true });
      } else {
        navigate(getDefaultRouteForRole(profile.role), { replace: true });
      }
    }
  }, [firebaseUser, emailVerified, profile, loading, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    setSubmitting(true);
    try {
      const userProfile = await loginWithEmail(email, password);
      if (userProfile.accountStatus === 'active') {
        navigate(getDefaultRouteForRole(userProfile.role), { replace: true });
      } else {
        navigate('/compte-en-attente', { replace: true });
      }
    } catch (err) {
      setError(translateFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const userProfile = await loginWithGoogle();
      if (userProfile.accountStatus === 'active') {
        navigate(getDefaultRouteForRole(userProfile.role), { replace: true });
      } else {
        navigate('/compte-en-attente', { replace: true });
      }
    } catch (err) {
      setError(translateFirebaseAuthError(err));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Connexion à votre espace"
      subtitle="Accédez à vos tâches, missions et plannings professionnels."
    >
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-400 rounded-lg px-3.5 py-3 text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleSubmitting || submitting}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
      >
        {googleSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#3578C8] dark:text-blue-400" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
        )}
        <span>Continuer avec Google</span>
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/80" />
        <span className="text-xs text-[#667085] dark:text-slate-400">ou par e-mail professionnel</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/80" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
            Adresse e-mail
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@entreprise.com"
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#3578C8]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200">
              Mot de passe
            </label>
            <Link
              to="/mot-de-passe-oublie"
              className="text-xs font-medium text-[#3578C8] dark:text-blue-400 hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#3578C8]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || googleSubmitting}
          className="w-full py-2.5 px-4 bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Se connecter</span>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#667085] dark:text-slate-400">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-[#3578C8] dark:text-blue-400 hover:underline">
          Créer un compte collaborateur
        </Link>
      </p>
    </AuthShell>
  );
}
