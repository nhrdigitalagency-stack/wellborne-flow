import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Globe,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  LabelManagerModal,
  TaskLabelInlineList,
  TaskLabelSelector,
} from '../../components/tasks/TaskLabels';
import {
  ConfirmDialog,
  Modal,
  PriorityLabel,
  ProgressBar,
  StatusLabel,
  TableSkeleton,
} from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { submitMissionWork } from '../../services/missions/missionService';
import {
  addSubtask,
  addTaskComment,
  removeSubtask,
  softDeleteTask,
  subscribeTaskById,
  subscribeTaskComments,
  subscribeTaskSubtasks,
  toggleSubtaskCompletion,
  updatePersonalTaskDetails,
} from '../../services/tasks/taskService';
import type { Subtask, Task, TaskComment, TaskPriority, TaskStatus } from '../../types';
import { formatDateFR, formatTimestampFR, getTodayDoualaISO, isTaskOverdue } from '../../utils/dateUtils';
import { PRIORITY_LABELS, STATUS_LABELS } from '../../utils/taskUtils';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { profile } = useAuth();
  const { taskLabelMap } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);

  const [newStepTitle, setNewStepTitle] = useState('');
  const [commentText, setCommentText] = useState('');
  const [manualProgress, setManualProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  const [editingDates, setEditingDates] = useState(false);
  const [editDueAt, setEditDueAt] = useState('');
  const [editPlannedDate, setEditPlannedDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('normal');

  useEffect(() => {
    if (!taskId) return;
    const unsub = subscribeTaskById(taskId, (t) => {
      setTask(t);
      if (t) {
        setManualProgress(t.progress);
        setEditDueAt(t.dueAt);
        setEditPlannedDate(t.plannedDate);
        setEditPriority(t.priority);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [taskId]);

  useEffect(() => {
    if (!task || !profile) return;
    const unsubSubs = subscribeTaskSubtasks(
      task.id,
      task.ownerId,
      task.publicationStatus === 'published',
      setSubtasks
    );
    const unsubComments = subscribeTaskComments(
      task.id,
      task.publicationStatus === 'published' ? 'company' : 'private',
      profile.uid,
      setComments
    );
    return () => {
      unsubSubs();
      unsubComments();
    };
  }, [task?.id, task?.ownerId, task?.publicationStatus, profile?.uid]);

  if (loading) return <TableSkeleton rows={5} />;

  if (!task || !profile) {
    return (
      <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-8 text-center">
        <p className="text-base font-bold text-[#172D4D] dark:text-slate-100 mb-2">
          Tâche introuvable
        </p>
        <p className="text-sm text-[#667085] dark:text-slate-400 mb-4">
          Cette tâche n’existe pas ou vous ne disposez pas des droits nécessaires pour la consulter.
        </p>
        <Link
          to="/mes-taches"
          className="text-sm font-semibold text-[#3578C8] dark:text-blue-400 hover:underline"
        >
          Retour à mes tâches
        </Link>
      </div>
    );
  }

  const todayISO = getTodayDoualaISO();
  const overdue = isTaskOverdue(task.dueAt, task.status, todayISO);
  const isOwner = task.ownerId === profile.uid;
  const isAdmin = profile.role === 'admin';
  const isTerminal = task.status === 'completed' || task.status === 'cancelled';
  const canEdit = (isOwner && !isTerminal) || isAdmin;
  const isMissionTask = task.source === 'mission';

  const handleToggleSubtask = async (sub: Subtask) => {
    if (!canEdit) return;
    try {
      await toggleSubtaskCompletion(profile, task, sub, subtasks);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de mise à jour', 'error');
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newStepTitle.trim()) return;
    setSaving(true);
    try {
      await addSubtask(profile, task, newStepTitle, '', subtasks);
      setNewStepTitle('');
      showToast('Étape ajoutée.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur ajout étape', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSubtask = async (subId: string) => {
    if (!canEdit) return;
    try {
      await removeSubtask(task, subId, subtasks);
      showToast('Étape supprimée.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur suppression étape', 'error');
    }
  };

  const handleStatusChange = async (nextStatus: TaskStatus) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updatePersonalTaskDetails(profile, task, { status: nextStatus });
      showToast(`Statut mis à jour : ${STATUS_LABELS[nextStatus]}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action refusée', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLabelsChange = async (nextLabelIds: string[]) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updatePersonalTaskDetails(profile, task, { labelIds: nextLabelIds });
      showToast('Étiquettes de la tâche mises à jour.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour étiquettes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleManualProgressSave = async () => {
    if (!canEdit || task.progressMode !== 'manual') return;
    setSaving(true);
    try {
      await updatePersonalTaskDetails(profile, task, { progress: manualProgress });
      showToast('Progression enregistrée.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!canEdit || task.publicationStatus === 'published') return;
    setSaving(true);
    try {
      await updatePersonalTaskDetails(profile, task, { publicationStatus: 'published' });
      showToast('Tâche publiée dans l’espace commun.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur publication', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      await updatePersonalTaskDetails(profile, task, {
        dueAt: editDueAt,
        plannedDate: editPlannedDate,
        priority: editPriority,
      });
      setEditingDates(false);
      showToast('Planification mise à jour.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMissionWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.assignmentId) return;
    setSaving(true);
    try {
      await submitMissionWork(profile, task.assignmentId, task.id, task.progress, submissionNote);
      setSubmitModalOpen(false);
      setSubmissionNote('');
      showToast('Votre travail a été soumis au responsable pour validation.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de soumission', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    setSaving(true);
    try {
      await softDeleteTask(profile, task);
      showToast('Tâche archivée (suppression logique avec historique conservé).');
      navigate('/mes-taches');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur archivage', 'error');
    } finally {
      setSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSaving(true);
    try {
      await addTaskComment(profile, task, commentText);
      setCommentText('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur commentaire', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="p-2 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085] dark:text-slate-400 mb-1">
              <span>{task.category}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                {task.publicationStatus === 'published' ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-[#3578C8] dark:text-blue-400" /> Publiée
                    (Espace commun)
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Brouillon privé
                  </>
                )}
              </span>
              {isMissionTask && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#3578C8] dark:text-blue-400 font-semibold">
                    Issue d’une mission
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl font-bold font-display text-[#172D4D] dark:text-slate-100 break-words">
              {task.title}
            </h1>
            <TaskLabelInlineList
              labelIds={task.labelIds}
              labelMap={taskLabelMap}
              maxVisible={8}
              showGroup
            />
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {task.publicationStatus === 'draft' && !isMissionTask && (
              <button
                type="button"
                onClick={handlePublishDraft}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-semibold text-[#172D4D] dark:text-slate-200 bg-white dark:bg-[#111C2E] border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Publier dans l’espace commun
              </button>
            )}
            {isMissionTask && task.status !== 'submitted' && task.status !== 'completed' && (
              <button
                type="button"
                onClick={() => setSubmitModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#172D4D] dark:bg-[#3578C8] hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] rounded-lg cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Soumettre pour validation
              </button>
            )}
            {!isMissionTask && task.status !== 'completed' && (
              <button
                type="button"
                onClick={() => handleStatusChange('completed')}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#16A36A] hover:bg-[#138a59] rounded-lg cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marquer terminée (100 %)
              </button>
            )}
            {!isMissionTask && !isTerminal && (
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="p-2 text-[#667085] dark:text-slate-400 hover:text-[#DC4545] dark:hover:text-red-400 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                title="Archiver (suppression logique)"
                aria-label="Archiver la tâche"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {!isOwner && !isAdmin && (
        <div className="bg-[#EAF2FC] dark:bg-[#172A45] border border-[#3578C8]/25 dark:border-blue-400/30 rounded-lg px-4 py-2.5 text-xs text-[#172D4D] dark:text-blue-100">
          Mode consultation uniquement : cette tâche appartient à <strong>{task.ownerName}</strong>.
          Vous pouvez consulter son avancement et ajouter un commentaire, mais seul le propriétaire
          peut la modifier.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Main Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Description */}
          <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6">
            <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100 mb-2">Description</h2>
            <p className="text-sm text-[#172D4D]/90 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {task.description || 'Aucune description détaillée renseignée.'}
            </p>
          </section>

          {/* Progress & Subtasks */}
          <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
                  Avancement et étapes ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                  {task.progressMode === 'auto'
                    ? 'Calcul automatique : (étapes terminées / total des étapes) × 100.'
                    : 'Progression manuelle contrôlée (0 à 99 % avant clôture officielle).'}
                </p>
              </div>
              <div className="w-40">
                <ProgressBar value={task.progress} overdue={overdue} />
              </div>
            </div>

            {task.progressMode === 'manual' && canEdit && !isTerminal && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[#F4F6FA] dark:bg-[#0F172A] rounded-lg">
                <label
                  htmlFor="manual-progress"
                  className="text-xs font-semibold text-[#172D4D] dark:text-slate-200"
                >
                  Progression manuelle : <span className="font-mono-num">{manualProgress}%</span>
                </label>
                <input
                  id="manual-progress"
                  type="range"
                  min={0}
                  max={99}
                  value={manualProgress}
                  onChange={(e) => setManualProgress(Number(e.target.value))}
                  className="flex-1 accent-[#3578C8]"
                />
                <button
                  type="button"
                  onClick={handleManualProgressSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#3578C8] text-white rounded-lg hover:bg-[#2a63a8] cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            )}

            {/* Subtask Checklist */}
            {subtasks.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg overflow-hidden">
                {subtasks.map((sub) => (
                  <li
                    key={sub.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F4F6FA]/60 dark:hover:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleToggleSubtask(sub)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer disabled:cursor-default"
                    >
                      <span
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          sub.completed
                            ? 'bg-[#16A36A] border-[#16A36A] text-white'
                            : 'bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {sub.completed && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span
                        className={`text-sm ${
                          sub.completed
                            ? 'line-through text-[#667085] dark:text-slate-500'
                            : 'text-[#172D4D] dark:text-slate-100'
                        }`}
                      >
                        {sub.title}
                      </span>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(sub.id)}
                        aria-label={`Supprimer ${sub.title}`}
                        className="p-1 text-slate-400 hover:text-[#DC4545] dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={200}
                  value={newStepTitle}
                  onChange={(e) => setNewStepTitle(e.target.value)}
                  placeholder="Ajouter une nouvelle étape à la checklist…"
                  className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={saving || !newStepTitle.trim()}
                  className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </form>
            )}
          </section>

          {/* Comments Thread */}
          <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#3578C8] dark:text-blue-400" />
              <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">
                Commentaires ({comments.length})
              </h2>
            </div>

            {comments.length === 0 ? (
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Aucun commentaire pour le moment. Utilisez cet espace pour suivre les échanges.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="p-3.5 rounded-lg bg-[#F4F6FA] dark:bg-[#0F172A] border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                        {c.authorName}
                      </span>
                      <span className="text-[11px] font-mono-num text-[#667085] dark:text-slate-400">
                        {formatTimestampFR(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#172D4D] dark:text-slate-200 whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddComment} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={2000}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Écrire un commentaire ou une observation…"
                className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 placeholder:text-[#667085] dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={saving || !commentText.trim()}
                className="px-4 py-2 text-xs font-semibold bg-[#3578C8] text-white rounded-lg hover:bg-[#2a63a8] cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Publier
              </button>
            </form>
          </section>
        </div>

        {/* Right Metadata Rail */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#172D4D] dark:text-slate-100">Informations</h2>

            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Statut</dt>
                <dd>
                  <StatusLabel status={task.status} overdue={overdue} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Priorité</dt>
                <dd>
                  <PriorityLabel priority={task.priority} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Responsable</dt>
                <dd className="text-xs font-semibold text-[#172D4D] dark:text-slate-100">
                  {task.ownerName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Auteur</dt>
                <dd className="text-xs text-[#172D4D] dark:text-slate-200">{task.creatorName}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Début</dt>
                <dd className="text-xs font-mono-num text-[#172D4D] dark:text-slate-200">
                  {formatDateFR(task.startAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Date prévue</dt>
                <dd className="text-xs font-mono-num text-[#172D4D] dark:text-slate-200">
                  {formatDateFR(task.plannedDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-[#667085] dark:text-slate-400">Date limite</dt>
                <dd
                  className={`text-xs font-mono-num font-semibold ${
                    overdue
                      ? 'text-[#DC4545] dark:text-red-400'
                      : 'text-[#172D4D] dark:text-slate-100'
                  }`}
                >
                  {formatDateFR(task.dueAt)}
                </dd>
              </div>
              {task.completedAt && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-[#667085] dark:text-slate-400">Clôturée le</dt>
                  <dd className="text-xs font-mono-num text-[#16A36A] dark:text-emerald-400">
                    {formatTimestampFR(task.completedAt)}
                  </dd>
                </div>
              )}
            </dl>

            {canEdit && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label
                  htmlFor="status-select"
                  className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200"
                >
                  Changer le statut
                </label>
                <select
                  id="status-select"
                  value={task.status}
                  disabled={saving}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
                >
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="blocked">En attente / bloquée</option>
                  {!isMissionTask && <option value="completed">Terminée</option>}
                </select>

                {!editingDates ? (
                  <button
                    type="button"
                    onClick={() => setEditingDates(true)}
                    className="w-full py-2 text-xs font-semibold text-[#3578C8] dark:text-blue-400 border border-[#3578C8]/30 dark:border-blue-400/30 rounded-lg hover:bg-[#EAF2FC] dark:hover:bg-[#172A45] cursor-pointer"
                  >
                    Modifier dates / priorité
                  </button>
                ) : (
                  <form onSubmit={handleSaveMetadata} className="space-y-2.5 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#667085] dark:text-slate-400 mb-1">
                        Date prévue
                      </label>
                      <input
                        type="date"
                        value={editPlannedDate}
                        onChange={(e) => setEditPlannedDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 font-mono-num"
                      />
                    </div>
                    {!isMissionTask && (
                      <>
                        <div>
                          <label className="block text-[11px] font-medium text-[#667085] dark:text-slate-400 mb-1">
                            Échéance
                          </label>
                          <input
                            type="date"
                            value={editDueAt}
                            onChange={(e) => setEditDueAt(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100 font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[#667085] dark:text-slate-400 mb-1">
                            Priorité
                          </label>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0F172A] text-[#172D4D] dark:text-slate-100"
                          >
                            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                              <option key={p} value={p}>
                                {PRIORITY_LABELS[p]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingDates(false)}
                        className="flex-1 py-1.5 text-xs text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-1.5 text-xs font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg cursor-pointer"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Custom Labels Panel */}
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700/80 rounded-lg p-5">
            {canEdit ? (
              <TaskLabelSelector
                selectedIds={task.labelIds || []}
                onChange={handleLabelsChange}
                onOpenManager={() => setLabelModalOpen(true)}
                disabled={saving}
              />
            ) : (
              <div>
                <h2 className="text-xs font-bold text-[#172D4D] dark:text-slate-100 mb-2">
                  Étiquettes personnalisées
                </h2>
                {task.labelIds && task.labelIds.length > 0 ? (
                  <TaskLabelInlineList
                    labelIds={task.labelIds}
                    labelMap={taskLabelMap}
                    maxVisible={8}
                    showGroup
                  />
                ) : (
                  <p className="text-xs text-[#667085] dark:text-slate-400">
                    Aucune étiquette associée à cette tâche.
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Submit Mission Work Modal */}
      <Modal
        open={submitModalOpen}
        title="Soumettre le travail pour validation"
        onClose={() => setSubmitModalOpen(false)}
      >
        <form onSubmit={handleSubmitMissionWork} className="space-y-4">
          <p className="text-sm text-[#667085] dark:text-slate-300">
            Votre responsable recevra une notification immédiate pour examiner votre avancement et
            approuver ou demander des corrections.
          </p>
          <div>
            <label
              htmlFor="submission-note"
              className="block text-xs font-semibold text-[#172D4D] dark:text-slate-200 mb-1.5"
            >
              Note de soumission / livrable
            </label>
            <textarea
              id="submission-note"
              rows={4}
              maxLength={2000}
              required
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
              placeholder="Décrivez ce qui a été réalisé, les liens ou remarques utiles pour la validation…"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#172D4D] dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setSubmitModalOpen(false)}
              className="px-4 py-2 text-sm text-[#172D4D] dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-[#172D4D] dark:bg-[#3578C8] text-white rounded-lg hover:bg-[#1e3a63] dark:hover:bg-[#2a63a8] cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Envoi…' : 'Confirmer la soumission'}
            </button>
          </div>
        </form>
      </Modal>

      <LabelManagerModal open={labelModalOpen} onClose={() => setLabelModalOpen(false)} />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Archiver cette tâche ?"
        description="Conformément aux règles de traçabilité WELLBORNE FLOW, la tâche sera marquée comme annulée (suppression logique) et son historique restera consultable par l’administrateur."
        confirmLabel="Archiver la tâche"
        danger
        loading={saving}
        onConfirm={handleSoftDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
