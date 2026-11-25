import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { UserAvatar } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { createAndPublishMission } from '../../services/missions/missionService';
import type { TaskPriority } from '../../types';
import { addDaysISO, getTodayDoualaISO } from '../../utils/dateUtils';
import { PRIORITY_LABELS, ROLE_LABELS, TASK_CATEGORIES } from '../../utils/taskUtils';

export function CreateMissionPage() {
  const { profile } = useAuth();
  const { teamDirectory } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const today = getTodayDoualaISO();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [instructions, setInstructions] = useState('');
  const [startAt, setStartAt] = useState(today);
  const [dueAt, setDueAt] = useState(addDaysISO(today, 5));
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [category, setCategory] = useState(TASK_CATEGORIES[0]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUsers = useMemo(
    () => teamDirectory.filter((u) => u.accountStatus === 'active'),
    [teamDirectory]
  );

  const toggleEmployee = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    if (!title.trim()) {
      setError('Le titre de la mission est obligatoire.');
      return;
    }
    if (dueAt < startAt) {
      setError('La date limite ne peut pas précéder la date de début.');
      return;
    }
    if (selectedUids.length === 0) {
      setError('Veuillez sélectionner au moins un collaborateur destinataire.');
      return;
    }

    const assignees = activeUsers.filter((u) => selectedUids.includes(u.uid));

    setSubmitting(true);
    try {
      await createAndPublishMission(profile, {
        title,
        description,
        objectives,
        instructions,
        startAt,
        dueAt,
        priority,
        category,
        checklistTemplate: steps.filter((s) => s.trim().length > 0),
        assignees,
      });
      showToast(
        `Mission publiée : ${assignees.length} affectation${
          assignees.length > 1 ? 's indépendantes créées' : ' indépendante créée'
        } et notifiée${assignees.length > 1 ? 's' : ''}.`
      );
      navigate('/toutes-les-missions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de la mission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="p-2 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
            Créer et attribuer une mission
          </h1>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            Chaque collaborateur sélectionné recevra une affectation, une acceptation et une progression indépendantes.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-400 rounded-lg px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-5">
          <div>
            <label htmlFor="m-title" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Titre de la mission *
            </label>
            <input
              id="m-title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Déploiement du portail client Q4"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label htmlFor="m-desc" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
              Description générale *
            </label>
            <textarea
              id="m-desc"
              rows={3}
              required
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="m-obj" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Objectifs attendus
              </label>
              <textarea
                id="m-obj"
                rows={3}
                maxLength={2000}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="Résultats mesurables attendus à la livraison…"
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="m-inst" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Instructions d’exécution
              </label>
              <textarea
                id="m-inst"
                rows={3}
                maxLength={4000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Consignes méthodologiques, ressources ou contraintes…"
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="m-start" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Date de début *
              </label>
              <input
                id="m-start"
                type="date"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="m-due" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Date limite *
              </label>
              <input
                id="m-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg font-mono-num text-[#172D4D] dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="m-prio" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Priorité
              </label>
              <select
                id="m-prio"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
              >
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m-cat" className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Catégorie
              </label>
              <select
                id="m-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checklist template */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">Modèle d’étapes à réaliser</h2>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Copié de manière indépendante dans la tâche individuelle de chaque collaborateur qui acceptera la mission.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSteps((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#3578C8] dark:text-blue-400 bg-[#EAF2FC] dark:bg-[#172A45] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter étape
              </button>
            </div>

            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono-num text-[#667085] dark:text-slate-400 w-6 text-right">
                  {i + 1}.
                </span>
                <input
                  type="text"
                  maxLength={200}
                  value={step}
                  onChange={(e) =>
                    setSteps((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                  placeholder={`Étape ${i + 1}…`}
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSteps((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
                  }
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-[#DC4545] dark:hover:text-red-400 cursor-pointer"
                  aria-label="Supprimer cette étape"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Employee Selector */}
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
              <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
                Attribution multi-collaborateurs ({selectedUids.length} sélectionné
                {selectedUids.length > 1 ? 's' : ''})
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedUids(
                  selectedUids.length === activeUsers.length ? [] : activeUsers.map((u) => u.uid)
                )
              }
              className="text-xs font-semibold text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer"
            >
              {selectedUids.length === activeUsers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeUsers.map((u) => {
              const checked = selectedUids.includes(u.uid);
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => toggleEmployee(u.uid)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    checked
                      ? 'bg-[#EAF2FC] dark:bg-[#172A45] border-[#3578C8] dark:border-blue-500'
                      : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700 hover:bg-[#F4F6FA] dark:hover:bg-slate-800/70'
                  }`}
                >
                  <UserAvatar firstName={u.firstName} lastName={u.lastName} photoURL={u.photoURL} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100 truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-slate-400 truncate">
                      {u.position || ROLE_LABELS[u.role]}
                    </p>
                  </div>
                  <span
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                      checked
                        ? 'bg-[#3578C8] border-[#3578C8] text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111C2E]'
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-sm font-medium text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Publier la mission ({selectedUids.length})</span>
          </button>
        </div>
      </form>
    </div>
  );
}
