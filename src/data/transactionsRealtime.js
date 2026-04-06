import { db, getCurrentUserId } from './firebaseClient';
import {
  collection,
  onSnapshot,
} from 'firebase/firestore';

// Normalise Firestore Timestamp/Date/string into an ISO string the rest of the
// app already understands.
function normaliseDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

// Subscribe to transactions in Firestore in real time. Falls back to a single
// IndexedDB fetch when Firebase is disabled or misconfigured.
//
// Returns an unsubscribe function.
export async function subscribeToTransactions(onData, onError) {
  if (!db) {
    if (onError) onError(new Error('Firestore is not configured.'));
    return () => {};
  }

  const userId = await getCurrentUserId().catch((err) => {
    if (onError) onError(err);
    return null;
  });

  if (!userId) {
    const data = await getLocalTransactions();
    onData(data);
    return () => {};
  }

  const txCol = collection(db, 'users', userId, 'transactions');
  const accCol = collection(db, 'users', userId, 'accounts');

  let accountsMap = new Map();
  let accountsLoaded = false;
  let txLoaded = false;
  let currentTxs = [];

  const emit = () => {
    if (!txLoaded) return;
    const withNames = currentTxs.map((t) => ({
      ...t,
      account_name:
        t.account_id && accountsMap.get(String(t.account_id))
          ? accountsMap.get(String(t.account_id))
          : null,
    }));

    withNames.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const dbt = b.date ? new Date(b.date).getTime() : 0;
      if (dbt !== da) return dbt - da;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    onData(withNames);
  };

  const unsubscribeAccounts = onSnapshot(
    accCol,
    (snap) => {
      accountsMap = new Map(
        snap.docs.map((d) => [d.id, (d.data() && d.data().name) || null]),
      );
      accountsLoaded = true;
      // We recalc account_name lazily when emitting; no heavy work here.
      if (txLoaded) emit();
    },
    (err) => {
      if (onError) onError(err);
    },
  );

  const unsubscribeTx = onSnapshot(
    txCol,
    (snap) => {
      currentTxs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          date: normaliseDate(data.date),
        };
      });
      txLoaded = true;
      emit();
    },
    (err) => {
      if (onError) onError(err);
    },
  );

  return () => {
    unsubscribeTx();
    unsubscribeAccounts();
  };
}
