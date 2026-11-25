import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { LabelManagerModal, TaskLabelSelector } from '../../components/tasks/TaskLabels';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createPersonalTask } from '../../services/tasks/taskService';
import type { PublicationStatus, TaskPriority } from '../../types';
import { addDaysISO, getTodayDoualaISO } from '../../utils/dateUtils';
import { PRIORITY_LABELS, TASK_CATEGORIES } from '../../utils/taskUtils';

interface StepDraft {
  id: string;
  title: string;
  description: string;
}

export function CreateTaskPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const today = getTodayDoualaISO();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState(today);
  const [plannedDate, setPlannedDate] = useState(today);
  const [dueAt, setDueAt] = useState(addDaysISO(today, 3));
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [category, setCategory] = useState(TASK_CATEGORIES[0]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [steps, setSteps] = useState<StepDraft[]>([{ id: '1', title: '', description: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStepRow = () => {
    setSteps((prev) => [...prev, { id: `${Date.now()}_${prev.length}`, title: '', description: '' }]);
  };

  const removeStepRow = (id: string) => {
    setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  };

  const updateStep = (id: string, field: 'title' | 'description', value: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const loadSpecExample = () => {
    setTitle('Création du site web d’une école');
    setDescription('Concevoir le site web de l’établissement scolaire et le rendre accessible en ligne.');
    setPriority('high');
    setCategory('Développement');
    setSteps([
      { id: 'ex1', title: 'Trouver un modèle adapté', description: '' },
      { id: 'ex2', title: 'Recueillir les informations de l’école', description: '' },
      { id: 'ex3', title: 'Préparer le cahier de contenu', description: '' },
      { id: 'ex4', title: 'Générer les différentes pages', description: '' },
      { id: 'ex5', title: 'Effectuer les tests', description: '' },
      { id: 'ex6', title: 'Corriger les erreurs', description: '' },
      { id: 'ex7', title: 'Mettre le site en ligne', description: '' },
    ]);
  };

  const handleSave = async (publicationStatus: PublicationStatus) => {
    if (!profile) return;
    setError(null);

    if (!title.trim()) {
      setError('Le titre de la tâche est obligatoire.');
      return;
    }
    if (dueAt < startAt) {
      setError('La date limite ne peut pas être antérieure à la date de début.');
      return;
    }

    setSubmitting(true);
    try {
      const taskId = await createPersonalTask(profile, {
        title,
        description,
        startAt,
        plannedDate,
        dueAt,
        priority,
        category,
        labelIds: selectedLabelIds,
        publicationStatus,
        subtasks: steps.filter((s) => s.title.trim().length > 0),
      });
      showToast(
        publicationStatus === 'published'
          ? 'Tâche créée et publiée dans l’espace commun.'
          : 'Tâche enregistrée en brouillon privé.'
      );
      navigate(`/taches/${taskId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="p-2 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100">
              Créer une nouvelle tâche
            </h1>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
              Enregistrez en brouillon privé ou publiez directement dans l’espace commun.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadSpecExample}
          className="text-xs font-medium text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer"
        >
          Charger le modèle d’exemple
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-300 rounded-lg px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-5">
        <div>
          <label
            htmlFor="task-title"
            className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
          >
            Titre de la tâche *
          </label>
          <input
            id="task-title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Finaliser la maquette de présentation client"
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
          />
        </div>

        <div>
          <label
            htmlFor="task-desc"
            className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
          >
            Description détaillée
          </label>
          <textarea
            id="task-desc"
            rows={4}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Précisez le contexte, les livrables attendus et les points clés…"
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="task-start"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
            >
              Date de début *
            </label>
            <input
              id="task-start"
              type="date"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 font-mono-num"
            />
          </div>
          <div>
            <label
              htmlFor="task-planned"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
            >
              Date prévue d’exécution *
            </label>
            <input
              id="task-planned"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 font-mono-num"
            />
          </div>
          <div>
            <label
              htmlFor="task-due"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
            >
              Date limite (échéance) *
            </label>
            <input
              id="task-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 font-mono-num"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="task-priority"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
            >
              Priorité
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="task-category"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
            >
              Catégorie
            </label>
            <select
              id="task-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 bg-white dark:bg-[#0F172A]"
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Labels Selector */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80">
          <TaskLabelSelector
            selectedIds={selectedLabelIds}
            onChange={setSelectedLabelIds}
            onOpenManager={() => setLabelModalOpen(true)}
            disabled={submitting}
          />
        </div>

        {/* Subtasks Builder */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
                Étapes de réalisation (sous-tâches)
              </h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                La progression (%) est calculée automatiquement dès qu’au moins une étape est ajoutée.
              </p>
            </div>
            <button
              type="button"
              onClick={addStepRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#3578C8] dark:text-blue-300 bg-[#EAF2FC] dark:bg-[#172A45] rounded-lg hover:bg-[#dcebfa] dark:hover:bg-[#1E3A5F] cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une étape
            </button>
          </div>

          <div className="space-y-2.5">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-2.5">
                <span className="text-xs font-mono-num text-[#667085] dark:text-slate-400 w-6 text-right shrink-0">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  maxLength={200}
                  value={step.title}
                  onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                  placeholder={`Étape ${idx + 1}…`}
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => removeStepRow(step.id)}
                  aria-label={`Supprimer l’étape ${idx + 1}`}
                  className="p-2 text-[#667085] dark:text-slate-400 hover:text-[#DC4545] dark:hover:text-red-400 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-700/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave('draft')}
            className="px-4 py-2.5 text-sm font-semibold text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            Enregistrer en brouillon
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSave('published')}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#3578C8] hover:bg-[#2a63a8] rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Publier la tâche</span>
          </button>
        </div>
      </div>

      <LabelManagerModal open={labelModalOpen} onClose={() => setLabelModalOpen(false)} />
    </div>
  );
}
