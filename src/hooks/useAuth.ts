import { useEffect, useState, useCallback } from 'react';
import { firebaseAuth, firebaseGoogleProvider } from '@/lib/firebase';

type FirebaseUser = any;

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

function friendlyAuthError(error: any): string {
  const code = error?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use a stronger password (at least 6 characters).',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account was found with this email.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };
  return messages[code] ?? error?.message ?? 'Authentication failed. Please try again.';
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((nextUser: FirebaseUser | null) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) setAuthError(null);
    });
    return unsubscribe;
  }, []);

  const runAuth = useCallback(async (operation: () => Promise<any>) => {
    setAuthError(null);
    try {
      await operation();
    } catch (error) {
      const message = friendlyAuthError(error);
      setAuthError(message);
      throw new Error(message);
    }
  }, []);

  const signInWithGoogle = useCallback(
    () => runAuth(() => firebaseAuth.signInWithPopup(firebaseGoogleProvider).then(() => undefined)),
    [runAuth],
  );

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      runAuth(() => firebaseAuth.signInWithEmailAndPassword(email.trim(), password).then(() => undefined)),
    [runAuth],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      await runAuth(async () => {
        const credential = await firebaseAuth.createUserWithEmailAndPassword(email.trim(), password);
        if (displayName?.trim() && credential.user) {
          await credential.user.updateProfile({ displayName: displayName.trim() });
        }
      });
    },
    [runAuth],
  );

  const resetPassword = useCallback(
    (email: string) => runAuth(() => firebaseAuth.sendPasswordResetEmail(email.trim())),
    [runAuth],
  );

  const getIdToken = useCallback(async () => {
    if (!firebaseAuth.currentUser) return null;
    return firebaseAuth.currentUser.getIdToken(true);
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseAuth.signOut();
    } catch (error) {
      const message = friendlyAuthError(error);
      setAuthError(message);
      throw new Error(message);
    }
  }, []);

  return { user, loading, authError, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, getIdToken, signOut };
}
