import React, { useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  createTaskLabel,
  deleteTaskLabel,
  updateTaskLabel,
} from '../../services/tasks/labelService';
import type { TaskLabel, TaskLabelColor, TaskLabelGroup } from '../../types';
import { Modal } from '../ui/Primitives';

export const LABEL_GROUP_ORDER: TaskLabelGroup[] = ['priority', 'department', 'project_type'];

export const LABEL_GROUP_LABELS: Record<TaskLabelGroup, string> = {
  priority: 'Priorité',
  department: 'Département',
  project_type: 'Type de projet',
};

export const LABEL_GROUP_EXAMPLES: Record<TaskLabelGroup, string> = {
  priority: 'Ex. Critique client, P0, Rapide',
  department: 'Ex. Finance, Produit, RH, Technique',
  project_type: 'Ex. Audit, Refonte, Lancement, Support',
};

export const LABEL_COLOR_META: Record<
  TaskLabelColor,
  {
    label: string;
    dot: string;
    text: string;
    activeButton: string;
  }
> = {
  blue: {
    label: 'Bleu',
    dot: 'bg-[#3578C8] dark:bg-blue-400',
    text: 'text-[#285E9E] dark:text-blue-300',
    activeButton:
      'border-[#3578C8] bg-[#EAF2FC] text-[#172D4D] dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-100',
  },
  navy: {
    label: 'Marine',
    dot: 'bg-[#172D4D] dark:bg-slate-200',
    text: 'text-[#172D4D] dark:text-slate-200',
    activeButton:
      'border-[#172D4D] bg-slate-100 text-[#172D4D] dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100',
  },
  green: {
    label: 'Vert',
    dot: 'bg-[#16A36A] dark:bg-emerald-400',
    text: 'text-[#138A59] dark:text-emerald-300',
    activeButton:
      'border-[#16A36A] bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-100',
  },
  amber: {
    label: 'Ambre',
    dot: 'bg-[#D97706] dark:bg-amber-400',
    text: 'text-[#B45309] dark:text-amber-300',
    activeButton:
      'border-[#D97706] bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-100',
  },
  red: {
    label: 'Rouge',
    dot: 'bg-[#DC4545] dark:bg-red-400',
    text: 'text-[#C53030] dark:text-red-300',
    activeButton:
      'border-[#DC4545] bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950/60 dark:text-red-100',
  },
  teal: {
    label: 'Sarcelle',
    dot: 'bg-[#0D9488] dark:bg-teal-400',
    text: 'text-[#0F766E] dark:text-teal-300',
    activeButton:
      'border-[#0D9488] bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100',
  },
  slate: {
    label: 'Ardoise',
    dot: 'bg-[#64748B] dark:bg-slate-400',
    text: 'text-[#475569] dark:text-slate-300',
    activeButton:
      'border-[#64748B] bg-slate-100 text-slate-900 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100',
  },
};

export const LABEL_COLORS = Object.keys(LABEL_COLOR_META) as TaskLabelColor[];

/**
 * Affichage typographique sobre (sans pilules lourdes) des étiquettes associées à une tâche.
 */
export function TaskLabelInlineList({
  labelIds,
  labelMap,
  maxVisible = 3,
  showGroup = false,
  className = 'mt-1',
}: {
  labelIds?: string[];
  labelMap: Map<string, TaskLabel>;
  maxVisible?: number;
  showGroup?: boolean;
  className?: string;
}) {
  if (!labelIds || labelIds.length === 0) return null;

  const resolved = labelIds
    .map((id) => labelMap.get(id))
    .filter((item): item is TaskLabel => Boolean(item));

  if (resolved.length === 0) return null;

  const visible = resolved.slice(0, maxVisible);
  const hiddenCount = resolved.length - visible.length;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`.trim()}
      aria-label="Étiquettes"
    >
      {visible.map((label) => {
        const meta = LABEL_COLOR_META[label.color] || LABEL_COLOR_META.blue;
        return (
          <span
            key={label.id}
            title={`${LABEL_GROUP_LABELS[label.group]} : ${label.name}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
            <span className={meta.text}>
              {showGroup ? `${LABEL_GROUP_LABELS[label.group]} · ` : ''}
              {label.name}
            </span>
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

/**
 * Sélecteur interactif groupé par Priorité, Département et Type de projet (max 8 étiquettes).
 */
export function TaskLabelSelector({
  selectedIds,
  onChange,
  onOpenManager,
  disabled = false,
}: {
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  onOpenManager: () => void;
  disabled?: boolean;
}) {
  const { taskLabels } = useWorkspace();

  const grouped = useMemo(() => {
    const map: Record<TaskLabelGroup, TaskLabel[]> = {
      priority: [],
      department: [],
      project_type: [],
    };
    for (const label of taskLabels) {
      if (map[label.group]) map[label.group].push(label);
    }
    return map;
  }, [taskLabels]);

  const toggle = (labelId: string) => {
    if (disabled) return;
    if (selectedIds.includes(labelId)) {
      onChange(selectedIds.filter((id) => id !== labelId));
    } else if (selectedIds.length < 8) {
      onChange([...selectedIds, labelId]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
            Étiquettes personnalisées{' '}
            <span className="font-mono-num font-normal text-[#667085] dark:text-slate-400">
              ({selectedIds.length}/8)
            </span>
          </p>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Catégorisez par priorité, département ou type de projet.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenManager}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#3578C8] dark:text-blue-300 bg-[#EAF2FC] dark:bg-[#172A45] hover:bg-[#dcebfa] dark:hover:bg-[#1E3A5F] rounded-lg transition-colors cursor-pointer"
        >
          <Tag className="w-3.5 h-3.5" />
          Gérer les étiquettes
        </button>
      </div>

      {taskLabels.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-[#F4F6FA]/70 dark:bg-[#0F172A] text-xs text-[#667085] dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <span>Aucune étiquette personnalisée créée pour l’instant dans votre espace.</span>
          <button
            type="button"
            onClick={onOpenManager}
            className="font-semibold text-[#3578C8] dark:text-blue-400 hover:underline cursor-pointer"
          >
            Créer la première étiquette
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {LABEL_GROUP_ORDER.map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#667085] dark:text-slate-400">
                  {LABEL_GROUP_LABELS[group]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((label) => {
                    const active = selectedIds.includes(label.id);
                    const meta = LABEL_COLOR_META[label.color] || LABEL_COLOR_META.blue;
                    const limitReached = !active && selectedIds.length >= 8;
                    return (
                      <button
                        key={label.id}
                        type="button"
                        disabled={disabled || limitReached}
                        aria-pressed={active}
                        onClick={() => toggle(label.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          active
                            ? meta.activeButton
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-200 hover:border-[#3578C8] dark:hover:border-blue-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
                        <span>{label.name}</span>
                        {active && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Fenêtre modale complète de création, modification et suppression des étiquettes d'entreprise.
 */
export function LabelManagerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const { taskLabels, myTasks, publishedTasks } = useWorkspace();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<TaskLabelGroup>('department');
  const [color, setColor] = useState<TaskLabelColor>('blue');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin';

  // Compter le nombre de tâches uniques utilisant chaque étiquette
  const usageCounts = useMemo(() => {
    const taskMap = new Map<string, string[]>();
    for (const t of publishedTasks) {
      if (!t.deletedAt && t.labelIds?.length) taskMap.set(t.id, t.labelIds);
    }
    for (const t of myTasks) {
      if (!t.deletedAt && t.labelIds?.length) taskMap.set(t.id, t.labelIds);
    }
    const counts = new Map<string, number>();
    for (const ids of taskMap.values()) {
      for (const id of ids) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return counts;
  }, [myTasks, publishedTasks]);

  const grouped = useMemo(() => {
    const map: Record<TaskLabelGroup, TaskLabel[]> = {
      priority: [],
      department: [],
      project_type: [],
    };
    for (const label of taskLabels) {
      if (map[label.group]) map[label.group].push(label);
    }
    return map;
  }, [taskLabels]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setGroup('department');
    setColor('blue');
    setError(null);
  };

  const startEdit = (label: TaskLabel) => {
    setEditingId(label.id);
    setName(label.name);
    setGroup(label.group);
    setColor(label.color);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Veuillez saisir un nom d’étiquette.');
      return;
    }

    const duplicate = taskLabels.find(
      (l) =>
        l.id !== editingId &&
        l.group === group &&
        l.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setError(`Une étiquette « ${duplicate.name} » existe déjà dans ${LABEL_GROUP_LABELS[group]}.`);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateTaskLabel(profile, editingId, { name: trimmed, group, color });
        showToast(`Étiquette « ${trimmed} » mise à jour.`);
      } else {
        await createTaskLabel(profile, { name: trimmed, group, color });
        showToast(`Étiquette « ${trimmed} » créée.`);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (label: TaskLabel) => {
    if (!profile) return;
    setDeletingId(label.id);
    setError(null);
    try {
      await deleteTaskLabel(profile, label);
      if (editingId === label.id) resetForm();
      showToast(`Étiquette « ${label.name} » supprimée.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cette étiquette.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      open={open}
      title="Gestion des étiquettes personnalisées"
      onClose={() => {
        resetForm();
        onClose();
      }}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        <p className="text-xs text-[#667085] dark:text-slate-400 leading-relaxed">
          Organisez les tâches de votre organisation par <strong className="text-[#172D4D] dark:text-slate-200">Priorité</strong>,{' '}
          <strong className="text-[#172D4D] dark:text-slate-200">Département</strong> ou{' '}
          <strong className="text-[#172D4D] dark:text-slate-200">Type de projet</strong>. Les étiquettes sont
          synchronisées en temps réel sur Firebase pour toute l’équipe.
        </p>

        {error && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#DC4545] dark:text-red-300 rounded-lg px-3.5 py-2.5 text-xs"
          >
            {error}
          </div>
        )}

        {/* Formulaire création / modification */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#F4F6FA] dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#172D4D] dark:text-slate-100">
              {editingId ? 'Modifier l’étiquette' : 'Nouvelle étiquette'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs text-[#667085] dark:text-slate-400 hover:text-[#172D4D] dark:hover:text-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Annuler l’édition
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="label-group"
                className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
              >
                Catégorie *
              </label>
              <select
                id="label-group"
                value={group}
                onChange={(e) => setGroup(e.target.value as TaskLabelGroup)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
              >
                {LABEL_GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {LABEL_GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="label-name"
                className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1"
              >
                Nom de l’étiquette *
              </label>
              <input
                id="label-name"
                type="text"
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={LABEL_GROUP_EXAMPLES[group]}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#111C2E] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5">
                Couleur de repère
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {LABEL_COLORS.map((c) => {
                  const meta = LABEL_COLOR_META[c];
                  const selected = color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={`Couleur ${meta.label}`}
                      aria-pressed={selected}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                        selected
                          ? meta.activeButton
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-[#667085] dark:text-slate-300'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#3578C8] hover:bg-[#2a63a8] text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap self-end"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : editingId ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>{editingId ? 'Enregistrer' : 'Ajouter'}</span>
            </button>
          </div>
        </form>

        {/* Liste des étiquettes existantes par catégorie */}
        <div className="space-y-4">
          {LABEL_GROUP_ORDER.map((g) => {
            const items = grouped[g];
            return (
              <div key={g} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#172D4D] dark:text-slate-200">
                    {LABEL_GROUP_LABELS[g]}
                  </h4>
                  <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
                    {items.length} étiquette{items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-[#667085] dark:text-slate-400 py-2">
                    Aucune étiquette dans cette catégorie.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden bg-white dark:bg-[#111C2E]">
                    {items.map((label) => {
                      const meta = LABEL_COLOR_META[label.color] || LABEL_COLOR_META.blue;
                      const count = usageCounts.get(label.id) || 0;
                      const canManage = isManagerOrAdmin || label.createdBy === profile?.uid;
                      return (
                        <li
                          key={label.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`}
                              aria-hidden="true"
                            />
                            <span className="text-sm font-medium text-[#172D4D] dark:text-slate-100 truncate">
                              {label.name}
                            </span>
                            <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400 whitespace-nowrap">
                              · {count} tâche{count > 1 ? 's' : ''}
                            </span>
                          </div>

                          {canManage ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEdit(label)}
                                aria-label={`Modifier ${label.name}`}
                                className="p-1.5 text-[#667085] dark:text-slate-400 hover:text-[#3578C8] dark:hover:text-blue-400 rounded-md cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === label.id}
                                onClick={() => handleDelete(label)}
                                aria-label={`Supprimer ${label.name}`}
                                className="p-1.5 text-[#667085] dark:text-slate-400 hover:text-[#DC4545] dark:hover:text-red-400 rounded-md cursor-pointer disabled:opacity-40"
                              >
                                {deletingId === label.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#667085] dark:text-slate-500">
                              Par {label.creatorName}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
