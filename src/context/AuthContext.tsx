import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  DEFAULT_ORG_SETTINGS,
  ensureUserDocuments,
  subscribeOrganizationSettings,
} from '../services/auth/authService';
import { auth, BOOTSTRAP_ADMIN_EMAIL, db } from '../services/firebase/config';
import type { OrganizationSettings, UserPrivate } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  emailVerified: boolean;
  tokenReady: boolean;
  profile: UserPrivate | null;
  orgSettings: OrganizationSettings;
  loading: boolean;
  isBootstrapAdmin: boolean;
  refreshAuthUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Garantit que le JWT envoyé à Firestore contient bien `email_verified: true`
 * après la confirmation d'e-mail (Firebase `user.reload()` seul ne rafraîchit pas le JWT).
 */
async function ensureVerifiedIdToken(user: User): Promise<boolean> {
  if (!user.emailVerified) return false;
  try {
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.email_verified === true) {
      return true;
    }
    // Forcer le rafraîchissement du JWT auprès des serveurs Firebase Auth
    await user.getIdToken(true);
    const refreshed = await user.getIdTokenResult();
    return refreshed.claims.email_verified === true;
  } catch {
    try {
      await user.getIdToken(true);
      return true;
    } catch {
      return false;
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [profile, setProfile] = useState<UserPrivate | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>({
    ...DEFAULT_ORG_SETTINGS,
    updatedBy: '',
    updatedAt: null as unknown as OrganizationSettings['updatedAt'],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubOrg: (() => void) | null = null;
    let currentUid: string | null = null;
    let activeRun = 0;

    const unsubAuth = onIdTokenChanged(auth, async (user) => {
      const runId = ++activeRun;
      setFirebaseUser(user);

      if (!user) {
        currentUid = null;
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        if (unsubOrg) {
          unsubOrg();
          unsubOrg = null;
        }
        setEmailVerified(false);
        setTokenReady(false);
        setProfile(null);
        setLoading(false);
        return;
      }

      const verifiedNow = Boolean(user.emailVerified);
      setEmailVerified(verifiedNow);

      if (verifiedNow) {
        const claimsVerified = await ensureVerifiedIdToken(user);
        if (runId !== activeRun) return;
        setTokenReady(claimsVerified);
      } else {
        setTokenReady(false);
      }

      // Éviter de détacher/réattacher inutilement les listeners profil lors d'un simple refresh de token du même UID
      if (currentUid === user.uid && unsubProfile) {
        return;
      }

      currentUid = user.uid;
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubOrg) {
        unsubOrg();
        unsubOrg = null;
      }

      try {
        await ensureUserDocuments(user);
      } catch (err) {
        console.error('Erreur initialisation profil:', err);
      }

      if (runId !== activeRun) return;

      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserPrivate);
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Erreur lecture profil utilisateur:', err);
          setLoading(false);
        }
      );

      unsubOrg = subscribeOrganizationSettings((settings) => {
        setOrgSettings(settings);
      });
    });

    return () => {
      activeRun++;
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubOrg) unsubOrg();
    };
  }, []);

  const refreshAuthUser = useCallback(async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;

    await user.reload();
    const verified = Boolean(user.emailVerified);
    setEmailVerified(verified);

    if (verified) {
      // Force le renouvellement du jeton JWT afin que request.auth.token.email_verified == true dans Firestore
      await user.getIdToken(true);
      const claimsVerified = await ensureVerifiedIdToken(user);
      setTokenReady(claimsVerified);
    } else {
      setTokenReady(false);
    }

    setFirebaseUser(auth.currentUser);
    await ensureUserDocuments(user);
    return verified;
  }, []);

  const isBootstrapAdmin = useMemo(() => {
    return (
      emailVerified &&
      (firebaseUser?.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
    );
  }, [firebaseUser, emailVerified]);

  const value = useMemo(
    () => ({
      firebaseUser,
      emailVerified,
      tokenReady,
      profile,
      orgSettings,
      loading,
      isBootstrapAdmin,
      refreshAuthUser,
    }),
    [firebaseUser, emailVerified, tokenReady, profile, orgSettings, loading, isBootstrapAdmin, refreshAuthUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  }
  return ctx;
}
