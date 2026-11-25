import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { requestPasswordReset, translateFirebaseAuthError } from '../../services/auth/authService';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse e-mail.');
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(translateFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Réinitialiser votre mot de passe"
      subtitle="Saisissez votre adresse e-mail professionnelle pour recevoir un lien sécurisé de réinitialisation."
    >
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-400 rounded-lg px-3.5 py-3 text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {sent ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-4 text-sm text-[#172D4D] dark:text-slate-100 mb-6">
          <div className="flex items-center gap-2 font-semibold text-[#16A36A] dark:text-emerald-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>E-mail de réinitialisation envoyé</span>
          </div>
          <p className="text-[#667085] dark:text-slate-300">
            Si un compte correspond à <strong className="text-[#172D4D] dark:text-slate-100">{email}</strong>, un lien
            de réinitialisation vient de vous être envoyé. Vérifiez également vos courriers indésirables.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Adresse e-mail
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@entreprise.com"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Envoyer le lien de réinitialisation</span>
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-[#667085] dark:text-slate-400">
        <Link to="/connexion" className="font-semibold text-[#3578C8] dark:text-blue-400 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthShell>
  );
}
