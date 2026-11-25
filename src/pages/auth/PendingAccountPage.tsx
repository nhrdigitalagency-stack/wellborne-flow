import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../services/auth/authService';
import { AuthShell } from './AuthShell';

export function PendingAccountPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const isSuspended = profile?.accountStatus === 'suspended';

  const handleLogout = async () => {
    await logoutUser();
    navigate('/connexion', { replace: true });
  };

  return (
    <AuthShell
      title={isSuspended ? 'Compte suspendu' : 'Activation en attente'}
      subtitle={
        isSuspended
          ? 'Votre accès à l’espace professionnel WELLBORNE FLOW a été temporairement désactivé.'
          : 'Votre compte collaborateur a bien été créé et votre adresse e-mail est vérifiée.'
      }
    >
      <div
        className={`p-4 rounded-lg border mb-6 flex items-start gap-3 ${
          isSuspended
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-400'
            : 'bg-[#EAF2FC] dark:bg-[#172A45] border-[#3578C8]/25 dark:border-blue-500/30 text-[#172D4D] dark:text-slate-100'
        }`}
      >
        {isSuspended ? (
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        ) : (
          <Clock className="w-5 h-5 text-[#3578C8] dark:text-blue-400 shrink-0 mt-0.5" />
        )}
        <div className="text-sm leading-relaxed">
          {isSuspended ? (
            <p>
              Pour des raisons de sécurité interne, les comptes suspendus ne peuvent plus consulter
              ni modifier les données de l’entreprise. Contactez votre administrateur.
            </p>
          ) : (
            <p>
              Conformément à la politique de sécurité interne, un administrateur doit activer votre
              compte avant l’ouverture de votre espace collectif. Vous recevrez une notification dès
              l’activation.
            </p>
          )}
        </div>
      </div>

      {profile && (
        <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm mb-6 border border-slate-200 dark:border-slate-700/80 rounded-lg px-4">
          <div className="py-2.5 flex justify-between gap-4">
            <dt className="text-[#667085] dark:text-slate-400">Collaborateur</dt>
            <dd className="font-medium text-[#172D4D] dark:text-slate-100">
              {profile.firstName} {profile.lastName}
            </dd>
          </div>
          <div className="py-2.5 flex justify-between gap-4">
            <dt className="text-[#667085] dark:text-slate-400">E-mail</dt>
            <dd className="font-medium text-[#172D4D] dark:text-slate-100 truncate">{profile.email}</dd>
          </div>
          <div className="py-2.5 flex justify-between gap-4">
            <dt className="text-[#667085] dark:text-slate-400">Statut</dt>
            <dd
              className={`font-semibold ${
                isSuspended ? 'text-[#DC4545] dark:text-red-400' : 'text-[#D97706] dark:text-amber-400'
              }`}
            >
              {isSuspended ? 'Suspendu' : 'En attente d’activation'}
            </dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="w-full py-2.5 px-4 bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] text-white text-sm font-semibold rounded-lg cursor-pointer"
      >
        Se déconnecter
      </button>
    </AuthShell>
  );
}
