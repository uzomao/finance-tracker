import { createContext, useContext, useEffect, useState } from 'react';
import { getOrCreateProfile } from '../data/profileService';
import { useAuthContext } from './AuthContext';

const ProfileContext = createContext({
  profile: null,
  profileId: null,
  loading: true,
  error: null,
  refreshProfile: async () => {},
});

export function ProfileProvider({ children }) {
  const { user, loading: authLoading } = useAuthContext();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const p = await getOrCreateProfile();
        if (cancelled) return;
        setProfile(p);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[profile] Failed to resolve profile', err);
        setError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);
  const refreshProfile = async () => {
    if (!user || authLoading) return;
    setLoading(true);
    setError(null);
    try {
      const p = await getOrCreateProfile();
      setProfile(p);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    profile,
    profileId: profile ? profile.id : null,
    loading,
    error,
    refreshProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  return useContext(ProfileContext);
}
