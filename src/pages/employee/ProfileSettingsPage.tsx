import React, { useState } from 'react';
import { Loader2, Moon, Save, Shield, Sun } from 'lucide-react';
import { UserAvatar } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import {
  changeOwnPassword,
  DEFAULT_NOTIFICATION_PREFS,
  translateFirebaseAuthError,
  updateOwnProfile,
} from '../../services/auth/authService';
import type { NotificationPreferences } from '../../types';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../../utils/taskUtils';

export function ProfileSettingsPage({ initialTab = 'profile' }: { initialTab?: 'profile' | 'preferences' }) {
  const { profile, firebaseUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [position, setPosition] = useState(profile?.position || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    profile?.notificationPreferences || DEFAULT_NOTIFICATION_PREFS
  );
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  if (!profile) return null;

  const isPasswordProvider = firebaseUser?.providerData.some((p) => p.providerId === 'password');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Le prénom et le nom sont obligatoires.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateOwnProfile(profile.uid, {
        firstName,
        lastName,
        position,
        department,
        photoURL,
        notificationPreferences: prefs,
      });
      showToast('Profil et préférences enregistrés.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de mise à jour', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Le nouveau mot de passe doit contenir au moins 6 caractères.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Les deux mots de passe ne correspondent pas.', 'error');
      return;
    }
    setPwSaving(true);
    try {
      await changeOwnPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      showToast('Mot de passe modifié avec succès.');
    } catch (err) {
      showToast(translateFirebaseAuthError(err), 'error');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
          {initialTab === 'preferences' ? 'Paramètres et préférences' : 'Mon profil collaborateur'}
        </h1>
        <p className="text-sm text-[#667085] dark:text-slate-400 mt-0.5">
          Gérez vos coordonnées autorisées, le thème d’affichage et vos préférences de notification.
          Votre rôle est géré uniquement par l’administrateur.
        </p>
      </div>

      {/* Read-only Identity & Role Summary */}
      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <UserAvatar
          firstName={firstName || profile.firstName}
          lastName={lastName || profile.lastName}
          photoURL={photoURL || profile.photoURL}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-[#172D4D] dark:text-slate-100">
            {profile.firstName} {profile.lastName}
          </h2>
          <p className="text-sm text-[#667085] dark:text-slate-400 truncate">{profile.email}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mt-2">
            <span className="inline-flex items-center gap-1 font-semibold text-[#172D4D] dark:text-slate-100">
              <Shield className="w-3.5 h-3.5 text-[#3578C8] dark:text-blue-400" />
              {ROLE_LABELS[profile.role]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#16A36A] dark:text-emerald-400 font-medium">
              {ACCOUNT_STATUS_LABELS[profile.accountStatus]}
            </span>
            <span aria-hidden="true">·</span>
            <span>Fuseau : {profile.timezone}</span>
          </div>
        </div>
      </div>

      {/* Appearance / Dark Mode Selector */}
      <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
            Apparence de l’interface
          </h3>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Choisissez le mode d’affichage pour réduire la fatigue oculaire lors d’une utilisation
            prolongée. Préférence enregistrée sur cet appareil.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              showToast('Mode clair activé.', 'info');
            }}
            aria-pressed={theme === 'light'}
            className={`text-left p-4 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer ${
              theme === 'light'
                ? 'border-[#3578C8] bg-[#EAF2FC] dark:bg-[#172A45]'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] hover:border-[#3578C8]'
            }`}
          >
            <div className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 text-[#D97706] shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100">Mode clair</p>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                Fond lumineux haute lisibilité pour les environnements de bureau éclairés.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              showToast('Mode sombre activé.', 'info');
            }}
            aria-pressed={theme === 'dark'}
            className={`text-left p-4 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer ${
              theme === 'dark'
                ? 'border-[#60A5FA] bg-[#172A45]'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] hover:border-[#3578C8]'
            }`}
          >
            <div className="p-2 rounded-lg bg-[#172D4D] border border-slate-700 text-blue-300 shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#172D4D] dark:text-slate-100">Mode sombre</p>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                Surfaces ardoise profonde à contraste maîtrisé pour un confort visuel prolongé.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Editable Profile & Notification Preferences */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-5"
      >
        <h3 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
          Informations personnelles
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="prof-first"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
            >
              Prénom *
            </label>
            <input
              id="prof-first"
              type="text"
              required
              maxLength={80}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="prof-last"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
            >
              Nom *
            </label>
            <input
              id="prof-last"
              type="text"
              required
              maxLength={80}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="prof-pos"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
            >
              Poste occupé
            </label>
            <input
              id="prof-pos"
              type="text"
              maxLength={120}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="prof-dept"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
            >
              Département
            </label>
            <input
              id="prof-dept"
              type="text"
              maxLength={120}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="prof-photo"
            className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
          >
            URL de photo de profil (facultatif)
          </label>
          <input
            id="prof-photo"
            type="url"
            maxLength={500}
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
          />
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-3">
          <h3 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
            Préférences de notifications
          </h3>
          {(
            [
              { key: 'inApp', label: 'Notifications internes dans l’application' },
              {
                key: 'dailyReminder',
                label: 'Rappel quotidien des tâches non terminées (20h00 Africa/Douala)',
              },
              {
                key: 'missionEvents',
                label: 'Alertes missions (attributions, validations, corrections)',
              },
              { key: 'commentEvents', label: 'Commentaires sur mes tâches' },
              { key: 'webPush', label: 'Recevoir les notifications push navigateur' },
            ] as const
          ).map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-3 text-sm text-[#172D4D] dark:text-slate-200 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={prefs[item.key]}
                onChange={(e) => setPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                className="w-4 h-4 accent-[#3578C8] rounded"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer les modifications
          </button>
        </div>
      </form>

      {/* Password Change (only for email/password accounts) */}
      {isPasswordProvider && (
        <form
          onSubmit={handlePasswordChange}
          className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-4"
        >
          <h3 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
            Modifier mon mot de passe
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-pw"
                className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
              >
                Nouveau mot de passe
              </label>
              <input
                id="new-pw"
                type="password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="conf-pw"
                className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="conf-pw"
                type="password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving}
              className="px-4 py-2 text-xs font-semibold bg-[#3578C8] text-white rounded-lg hover:bg-[#2a63a8] cursor-pointer disabled:opacity-50"
            >
              {pwSaving ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
