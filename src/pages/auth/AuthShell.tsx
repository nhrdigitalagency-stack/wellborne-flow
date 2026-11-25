import React from 'react';
import { CheckCircle2, Moon, ShieldCheck, Sun, Target, Users } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0B1320] grid lg:grid-cols-12">
      {/* Left Brand Column */}
      <div className="hidden lg:flex lg:col-span-5 bg-[#172D4D] dark:bg-[#0D1A2D] text-white p-12 flex-col justify-between border-r border-transparent dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-[#3578C8] flex items-center justify-center font-display font-bold text-sm">
              WF
            </div>
            <span className="font-display font-bold text-xl tracking-tight">WELLBORNE FLOW</span>
          </div>

          <h1 className="text-3xl font-bold font-display leading-tight mb-4 max-w-md">
            Organisez. Exécutez. Progressez.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed max-w-md mb-10">
            Plateforme collaborative de pilotage des tâches, missions multi-collaborateurs,
            plannings et rapports d’activité professionnels.
          </p>

          <ul className="space-y-4 max-w-md">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#3578C8] dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Suivi précis des tâches et étapes</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Calcul automatique de l’avancement, échéances et espace commun de l’entreprise.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Target className="w-5 h-5 text-[#3578C8] dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Missions multi-employés indépendantes</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Chaque collaborateur dispose de sa propre acceptation, progression et validation.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Users className="w-5 h-5 text-[#3578C8] dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Rapports et rappels automatisés</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Rappels quotidiens à 20h00 et rapports hebdomadaires (fuseau Africa/Douala).
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#3578C8] dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Contrôle d’accès par rôle</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sécurité Firestore dédiée pour Employé, Responsable et Administrateur.
                </p>
              </div>
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-400">
          WELLBORNE FLOW · Plateforme d’entreprise · Fuseau horaire Africa/Douala
        </p>
      </div>

      {/* Right Form Column */}
      <div className="lg:col-span-7 relative flex flex-col justify-center items-center p-6 sm:p-10">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-[#172D4D] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[#667085]" />}
          <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>
        </button>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-[#172D4D] dark:bg-[#3578C8] text-white flex items-center justify-center font-display font-bold text-xs">
              WF
            </div>
            <div>
              <p className="font-display font-bold text-lg text-[#172D4D] dark:text-slate-100 leading-none">
                WELLBORNE FLOW
              </p>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                Organisez. Exécutez. Progressez.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold font-display text-[#172D4D] dark:text-slate-100 mb-1.5">
              {title}
            </h2>
            <p className="text-sm text-[#667085] dark:text-slate-400 mb-6">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
