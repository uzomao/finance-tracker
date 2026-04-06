import { db, getCurrentUserId } from './firebaseClient';
import { collection, onSnapshot } from 'firebase/firestore';

// Subscribe to accounts in Firestore in real time. Falls back to a single
// IndexedDB fetch when Firebase is disabled or misconfigured.
//
// Returns an unsubscribe function.
export async function subscribeToAccounts(onData, onError) {
  if (!db) {
    if (onError) onError(new Error('Firestore is not configured.'));
    return () => {};
  }

  const userId = await getCurrentUserId().catch((err) => {
    if (onError) onError(err);
    return null;
  });

  if (!userId) {
    const data = await getLocalAccounts();
    onData(data);
    return () => {};
  }

  const accCol = collection(db, 'users', userId, 'accounts');

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
