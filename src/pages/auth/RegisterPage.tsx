import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { getDefaultRouteForRole } from '../../routes/ProtectedRoute';
import {
  loginWithGoogle,
  registerWithEmail,
  translateFirebaseAuthError,
} from '../../services/auth/authService';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Veuillez renseigner votre nom, votre prénom et votre adresse e-mail.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      await registerWithEmail({
        firstName,
        lastName,
        email,
        password,
        position,
        department,
      });
      navigate('/verification-email', { replace: true });
    } catch (err) {
      setError(translateFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const profile = await loginWithGoogle();
      if (profile.accountStatus === 'active') {
        navigate(getDefaultRouteForRole(profile.role), { replace: true });
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
      title="Créer un compte collaborateur"
      subtitle="Tout nouveau compte reçoit automatiquement le rôle Employé. L’administrateur contrôle l’activation de l’accès collectif."
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
        onClick={handleGoogleRegister}
        disabled={googleSubmitting || submitting}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-[#172D4D] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
      >
        {googleSubmitting && <Loader2 className="w-4 h-4 animate-spin text-[#3578C8] dark:text-blue-400" />}
        <span>S’inscrire avec Google</span>
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/80" />
        <span className="text-xs text-[#667085] dark:text-slate-400">ou par formulaire</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/80" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="reg-firstname" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
              Prénom *
            </label>
            <input
              id="reg-firstname"
              type="text"
              required
              maxLength={80}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="reg-lastname" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
              Nom *
            </label>
            <input
              id="reg-lastname"
              type="text"
              required
              maxLength={80}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
            Adresse e-mail professionnelle *
          </label>
          <input
            id="reg-email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@entreprise.com"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="reg-position" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
              Poste occupé (facultatif)
            </label>
            <input
              id="reg-position"
              type="text"
              maxLength={120}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Ex. Développeur, Chargé de projet"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <div>
            <label htmlFor="reg-department" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
              Département (facultatif)
            </label>
            <input
              id="reg-department"
              type="text"
              maxLength={120}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex. Technique, Commercial"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
            Mot de passe *
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              className="w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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

        <div>
          <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1">
            Confirmation du mot de passe *
          </label>
          <input
            id="reg-confirm"
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || googleSubmitting}
          className="w-full py-2.5 px-4 bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Créer mon compte</span>
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[#667085] dark:text-slate-400">
        Déjà inscrit ?{' '}
        <Link to="/connexion" className="font-semibold text-[#3578C8] dark:text-blue-400 hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}
