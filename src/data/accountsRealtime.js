import { db } from './firebaseClient';
import { getActiveProfileId } from './profileService';
import { collection, onSnapshot } from 'firebase/firestore';

// Subscribe to accounts in Firestore in real time, scoped to the
// current profile. Returns an unsubscribe function.
//
export async function subscribeToAccounts(onData, onError) {
  if (!db) {
    if (onError) onError(new Error('Firestore is not configured.'));
    return () => {};
  }

  const profileId = await getActiveProfileId().catch((err) => {
    if (onError) onError(err);
    return null;
  });

  if (!profileId) {
    if (onError) onError(new Error('No active profile.'));
    return () => {};
  }

  const accCol = collection(db, 'profiles', profileId, 'accounts');

  const unsubscribe = onSnapshot(
    accCol,
    (snap) => {
      const accounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      accounts.sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        if (tb !== ta) return tb - ta;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

      onData(accounts);
    },
    (err) => {
      if (onError) onError(err);
    },
  );

  return unsubscribe;
}
