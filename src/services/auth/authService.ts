import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  AccountStatus,
  NotificationPreferences,
  OrganizationSettings,
  UserPrivate,
  UserPublic,
  UserRole,
} from '../../types';
import { DEFAULT_TIMEZONE } from '../../utils/dateUtils';
import { sanitizeText } from '../../utils/taskUtils';
import { recordAuditLog } from '../audit/auditService';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase/config';
import { createNotification } from '../notifications/notificationService';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  inApp: true,
  dailyReminder: true,
  webPush: false,
  missionEvents: true,
  commentEvents: true,
};

export const DEFAULT_ORG_SETTINGS: Omit<OrganizationSettings, 'updatedAt' | 'updatedBy'> = {
  companyName: 'WELLBORNE FLOW',
  timezone: DEFAULT_TIMEZONE,
  reminderTime: '20:00',
  requireAdminActivation: true,
  requirePersonalTaskApproval: false,
  weeklyReportDay: 'monday',
  weeklyReportTime: '06:00',
};

export function translateFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Cette adresse e-mail est déjà associée à un compte WELLBORNE FLOW.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-email':
      return 'L’adresse e-mail saisie n’est pas valide.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.';
    case 'auth/popup-closed-by-user':
      return 'La fenêtre de connexion Google a été fermée avant la fin de l’opération.';
    case 'auth/popup-blocked':
      return 'Votre navigateur a bloqué la fenêtre de connexion Google. Veuillez autoriser les fenêtres contextuelles.';
    case 'auth/operation-not-allowed':
      return 'La connexion par e-mail/mot de passe n’est pas encore activée dans la console Firebase. Utilisez « Continuer avec Google » ou activez le fournisseur E-mail/Mot de passe dans Firebase Authentication.';
    case 'auth/requires-recent-login':
      return 'Par sécurité, veuillez vous reconnecter récemment avant de modifier votre mot de passe.';
    default:
      return error instanceof Error ? error.message : 'Une erreur d’authentification est survenue.';
  }
}

function splitDisplayName(displayName?: string | null, email?: string | null): { firstName: string; lastName: string } {
  const cleaned = (displayName || '').trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: sanitizeText(parts[0], 80),
        lastName: sanitizeText(parts.slice(1).join(' '), 80),
      };
    }
    return { firstName: sanitizeText(parts[0], 80), lastName: 'Collaborateur' };
  }
  const prefix = (email || 'utilisateur').split('@')[0];
  return { firstName: sanitizeText(prefix, 80) || 'Utilisateur', lastName: 'WELLBORNE FLOW' };
}

type EnsureUserOverrides = {
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
};

const pendingEnsureByUid = new Map<string, Promise<UserPrivate>>();
const pendingRegistrationOverrides = new Map<string, EnsureUserOverrides>();

/**
 * S'assure de manière idempotente et atomique que users/{uid}, usersPublic/{uid}
 * et (pour l'admin initial) organizationSettings/global existent dans Firestore.
 * Déduplique les appels concurrents entre loginWithGoogle/registerWithEmail et onAuthStateChanged.
 */
export async function ensureUserDocuments(
  firebaseUser: User,
  overrides?: EnsureUserOverrides
): Promise<UserPrivate> {
  const uid = firebaseUser.uid;
  const emailKey = (firebaseUser.email || '').trim().toLowerCase();
  const effectiveOverrides = overrides ?? pendingRegistrationOverrides.get(emailKey);

  const existingInFlight = pendingEnsureByUid.get(uid);
  if (existingInFlight) {
    return existingInFlight;
  }

  const run = (async (): Promise<UserPrivate> => {
    const userRef = doc(db, 'users', uid);
    const publicRef = doc(db, 'usersPublic', uid);

    let existingSnap;
    try {
      existingSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }

    const isBootstrapAdmin =
      Boolean(firebaseUser.emailVerified) &&
      emailKey === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    if (existingSnap.exists()) {
      const data = existingSnap.data() as UserPrivate;
      if (firebaseUser.emailVerified && !data.emailVerified) {
        try {
          await updateDoc(userRef, {
            emailVerified: true,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Non bloquant
        }
      }
      try {
        const pubSnap = await getDoc(publicRef);
        if (!pubSnap.exists()) {
          await setDoc(publicRef, {
            uid,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            position: data.position || '',
            department: data.department || '',
            accountStatus: data.accountStatus,
            photoURL: data.photoURL || '',
            workspaceVisibility: 'company',
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non bloquant si déjà créé en parallèle
      }
      return data;
    }

    // Lire organizationSettings/global pour savoir si l'activation manuelle est exigée
    let requireAdminActivation = true;
    try {
      const orgSnap = await getDoc(doc(db, 'organizationSettings', 'global'));
      if (orgSnap.exists()) {
        const orgData = orgSnap.data() as OrganizationSettings;
        requireAdminActivation = Boolean(orgData.requireAdminActivation);
      }
    } catch {
      requireAdminActivation = true;
    }

    const fallbackNames = splitDisplayName(firebaseUser.displayName, firebaseUser.email);
    const firstName =
      sanitizeText(effectiveOverrides?.firstName || fallbackNames.firstName, 80) || 'Utilisateur';
    const lastName =
      sanitizeText(effectiveOverrides?.lastName || fallbackNames.lastName, 80) || 'WELLBORNE FLOW';
    const position = sanitizeText(
      effectiveOverrides?.position || (isBootstrapAdmin ? 'Administrateur plateforme' : ''),
      120
    );
    const department = sanitizeText(
      effectiveOverrides?.department || (isBootstrapAdmin ? 'Direction' : ''),
      120
    );
    const role: UserRole = isBootstrapAdmin ? 'admin' : 'employee';
    const accountStatus: AccountStatus = isBootstrapAdmin
      ? 'active'
      : requireAdminActivation
      ? 'pending'
      : 'active';

    const now = serverTimestamp();

    const privatePayload = {
      uid,
      firstName,
      lastName,
      email: sanitizeText(firebaseUser.email || '', 254),
      role,
      position,
      department,
      accountStatus,
      emailVerified: Boolean(firebaseUser.emailVerified),
      photoURL: sanitizeText(firebaseUser.photoURL || '', 500),
      timezone: DEFAULT_TIMEZONE,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
      createdAt: now,
      updatedAt: now,
    };

    const publicPayload = {
      uid,
      firstName,
      lastName,
      role,
      position,
      department,
      accountStatus,
      photoURL: sanitizeText(firebaseUser.photoURL || '', 500),
      workspaceVisibility: 'company' as const,
      updatedAt: now,
    };

    try {
      await runTransaction(db, async (tx) => {
        const [txUserSnap, txPubSnap] = await Promise.all([tx.get(userRef), tx.get(publicRef)]);
        if (!txUserSnap.exists()) {
          tx.set(userRef, privatePayload);
        }
        if (!txPubSnap.exists()) {
          tx.set(publicRef, publicPayload);
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    } finally {
      if (emailKey) {
        pendingRegistrationOverrides.delete(emailKey);
      }
    }

    // Initialiser organizationSettings/global lors du premier boot administrateur
    if (isBootstrapAdmin) {
      try {
        const orgRef = doc(db, 'organizationSettings', 'global');
        const orgSnap = await getDoc(orgRef);
        if (!orgSnap.exists()) {
          await setDoc(orgRef, {
            ...DEFAULT_ORG_SETTINGS,
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Non bloquant
      }
    }

    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserPrivate;
  })();

  pendingEnsureByUid.set(uid, run);
  try {
    return await run;
  } finally {
    pendingEnsureByUid.delete(uid);
  }
}

export async function loginWithGoogle(): Promise<UserPrivate> {
  const result = await signInWithPopup(auth, googleProvider);
  return ensureUserDocuments(result.user);
}

export async function loginWithEmail(email: string, password: string): Promise<UserPrivate> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserDocuments(result.user);
}

export async function registerWithEmail(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  position?: string;
  department?: string;
}): Promise<UserPrivate> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const overrides: EnsureUserOverrides = {
    firstName: params.firstName,
    lastName: params.lastName,
    position: params.position,
    department: params.department,
  };
  pendingRegistrationOverrides.set(normalizedEmail, overrides);

  try {
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    const fullName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
    await updateProfile(cred.user, { displayName: fullName });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non bloquant si l'envoi d'e-mail est limité
    }
    return await ensureUserDocuments(cred.user, overrides);
  } catch (error) {
    pendingRegistrationOverrides.delete(normalizedEmail);
    throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) throw new Error('Aucun utilisateur connecté.');
  await sendEmailVerification(auth.currentUser);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function updateOwnProfile(
  uid: string,
  updates: {
    firstName: string;
    lastName: string;
    position: string;
    department: string;
    photoURL: string;
    notificationPreferences: NotificationPreferences;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();
    batch.update(doc(db, 'users', uid), {
      firstName: sanitizeText(updates.firstName, 80),
      lastName: sanitizeText(updates.lastName, 80),
      position: sanitizeText(updates.position, 120),
      department: sanitizeText(updates.department, 120),
      photoURL: sanitizeText(updates.photoURL, 500),
      notificationPreferences: updates.notificationPreferences,
      updatedAt: now,
    });
    batch.update(doc(db, 'usersPublic', uid), {
      firstName: sanitizeText(updates.firstName, 80),
      lastName: sanitizeText(updates.lastName, 80),
      position: sanitizeText(updates.position, 120),
      department: sanitizeText(updates.department, 120),
      photoURL: sanitizeText(updates.photoURL, 500),
      updatedAt: now,
    });
    await batch.commit();

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: `${updates.firstName.trim()} ${updates.lastName.trim()}`.trim(),
        photoURL: updates.photoURL.trim() || null,
      }).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function changeOwnPassword(newPassword: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Session expirée.');
  await updatePassword(auth.currentUser, newPassword);
}

export async function adminUpdateUserAccess(
  adminActor: UserPrivate,
  targetUid: string,
  updates: {
    role: UserRole;
    accountStatus: AccountStatus;
    position?: string;
    department?: string;
  },
  previousStatus?: AccountStatus
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    const now = serverTimestamp();
    const batch = writeBatch(db);
    const patch: Record<string, unknown> = {
      role: updates.role,
      accountStatus: updates.accountStatus,
      updatedAt: now,
    };
    if (updates.position !== undefined) patch.position = sanitizeText(updates.position, 120);
    if (updates.department !== undefined) patch.department = sanitizeText(updates.department, 120);

    batch.update(doc(db, 'users', targetUid), patch);
    batch.update(doc(db, 'usersPublic', targetUid), patch);
    await batch.commit();

    await recordAuditLog({
      actorUid: adminActor.uid,
      actorName: `${adminActor.firstName} ${adminActor.lastName}`,
      action: 'user_access_updated',
      entityType: 'user',
      entityId: targetUid,
      metadata: {
        role: updates.role,
        accountStatus: updates.accountStatus,
      },
    });

    if (previousStatus !== 'active' && updates.accountStatus === 'active') {
      await createNotification({
        recipientId: targetUid,
        type: 'account_activated',
        title: 'Votre compte WELLBORNE FLOW est activé',
        message: 'Votre accès à l’espace collectif de l’entreprise a été activé par un administrateur.',
        entityType: 'account',
        entityId: targetUid,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrganizationSettings(
  adminActor: UserPrivate,
  settings: Omit<OrganizationSettings, 'updatedAt' | 'updatedBy'>
): Promise<void> {
  const path = 'organizationSettings/global';
  try {
    await setDoc(doc(db, 'organizationSettings', 'global'), {
      companyName: sanitizeText(settings.companyName, 120),
      timezone: sanitizeText(settings.timezone || DEFAULT_TIMEZONE, 64),
      reminderTime: settings.reminderTime,
      requireAdminActivation: Boolean(settings.requireAdminActivation),
      requirePersonalTaskApproval: Boolean(settings.requirePersonalTaskApproval),
      weeklyReportDay: settings.weeklyReportDay,
      weeklyReportTime: settings.weeklyReportTime,
      updatedBy: adminActor.uid,
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: adminActor.uid,
      actorName: `${adminActor.firstName} ${adminActor.lastName}`,
      action: 'organization_settings_updated',
      entityType: 'settings',
      entityId: 'global',
      metadata: {
        companyName: settings.companyName,
        reminderTime: settings.reminderTime,
        requireAdminActivation: settings.requireAdminActivation,
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeOrganizationSettings(
  onData: (settings: OrganizationSettings) => void
): () => void {
  const path = 'organizationSettings/global';
  return onSnapshot(
    doc(db, 'organizationSettings', 'global'),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as OrganizationSettings);
      } else {
        onData({
          ...DEFAULT_ORG_SETTINGS,
          updatedBy: '',
          updatedAt: null as unknown as OrganizationSettings['updatedAt'],
        });
      }
    },
    () => {
      onData({
        ...DEFAULT_ORG_SETTINGS,
        updatedBy: '',
        updatedAt: null as unknown as OrganizationSettings['updatedAt'],
      });
    }
  );
}

export function subscribeTeamDirectory(onData: (users: UserPublic[]) => void): () => void {
  const path = 'usersPublic';
  const q = query(collection(db, path), where('workspaceVisibility', '==', 'company'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as UserPublic)
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr'));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}
