import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../data/firebaseClient';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { clearCachedProfile, updateProfileFields } from '../data/profileService';

const AuthContext = createContext({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOutUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setUser(null);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
      clearCachedProfile();
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, []);

  const signIn = async (email, password) => {
    if (!auth) throw new Error('Firebase auth is not configured.');
    setError(null);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email, password, displayName) => {
    if (!auth) throw new Error('Firebase auth is not configured.');
    setError(null);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
      try {
        await updateProfileFields({ displayName });
      } catch {
        // ignore profile write failures here; user can edit later
      }
    }
  };

  const signOutUser = async () => {
    if (!auth) return;
    setError(null);
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
