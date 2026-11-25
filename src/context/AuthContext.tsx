import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
  profile: UserPrivate | null;
  orgSettings: OrganizationSettings;
  loading: boolean;
  isBootstrapAdmin: boolean;
  refreshAuthUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
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

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubOrg) {
        unsubOrg();
        unsubOrg = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        await ensureUserDocuments(user);
      } catch (err) {
        console.error('Erreur initialisation profil:', err);
      }

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
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubOrg) unsubOrg();
    };
  }, []);

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setFirebaseUser(auth.currentUser);
    await ensureUserDocuments(auth.currentUser);
  };

  const isBootstrapAdmin = useMemo(() => {
    return (
      Boolean(firebaseUser?.emailVerified) &&
      (firebaseUser?.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
    );
  }, [firebaseUser]);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      orgSettings,
      loading,
      isBootstrapAdmin,
      refreshAuthUser,
    }),
    [firebaseUser, profile, orgSettings, loading, isBootstrapAdmin]
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
