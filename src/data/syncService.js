// Background sync service: pushes pending local changes in IndexedDB to
// Firebase when enabled. All UI reads/writes remain IndexedDB-first.

import { USE_FIREBASE } from '../config';
import {
  getPendingAccounts,
  getPendingTransactions,
  markAccountSynced,
  markTransactionSynced,
} from './db.local';
import { db, getCurrentUserId } from './firebaseClient';

import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

let isSyncing = false;
let hasStarted = false;
let intervalId = null;

// Simple last-write-wins strategy based on the local _lastModified timestamp.
// For now we always push local state to Firebase and do not pull remote
// changes back into IndexedDB. If remote writes happen independently, the
// latest write (local or remote) will win at the Firebase level.

export async function syncPendingToFirebase() {
  if (!USE_FIREBASE || !db) {
    return; // Fast no-op when Firebase is disabled or not configured
  }

  if (!navigator.onLine) {
    return; // Defer until the next interval/online event
  }

  if (isSyncing) {
    return; // Avoid overlapping sync runs
  }

  isSyncing = true;

  try {
    const [pendingAccounts, pendingTransactions] = await Promise.all([
      getPendingAccounts(),
      getPendingTransactions(),
    ]);

    if (pendingAccounts.length === 0 && pendingTransactions.length === 0) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[sync] Starting sync: ${pendingAccounts.length} accounts, ${pendingTransactions.length} transactions pending`,
    );

    const userId = await getCurrentUserId().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[sync] Failed to resolve Firebase user; skipping sync run.', err);
      return null;
    });

    if (!userId) return;

    const accountsCol = collection(db, 'users', userId, 'accounts');
    const txCol = collection(db, 'users', userId, 'transactions');

    let syncedCount = 0;

    // --- Accounts ---
    for (const acc of pendingAccounts) {
      try {
        const baseData = {
          name: acc.name,
          percentage: acc.percentage,
          keywords: acc.keywords || '',
          _lastModified: acc._lastModified || Date.now(),
          localId: acc.id,
          deleted: !!acc._deleted,
        };

        if (acc._deleted) {
          // Propagate deletion to Firebase, then hard-delete locally.
          if (acc._remoteId) {
            await deleteDoc(doc(accountsCol, acc._remoteId));
          }
          await markAccountSynced(acc.id, { hardDelete: true });
        } else if (acc._remoteId) {
          // Existing remote record – last-write-wins, so we just overwrite/merge.
          await setDoc(
            doc(accountsCol, acc._remoteId),
            {
              ...baseData,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          await markAccountSynced(acc.id, { remoteId: acc._remoteId });
        } else {
          // First time sync – create a new document and remember its id locally.
          const docRef = await addDoc(accountsCol, {
            ...baseData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await markAccountSynced(acc.id, { remoteId: docRef.id });
        }

        syncedCount += 1;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[sync] Failed to sync account', acc.id, err);
        // Keep _pendingSync=true so we can retry on the next run.
      }
    }

    // --- Transactions ---
    for (const tx of pendingTransactions) {
      try {
        const baseData = {
          amount: tx.amount,
          description: tx.description || '',
          type: tx.type,
          account_id: tx.account_id != null ? String(tx.account_id) : null,
          date: tx.date ? new Date(tx.date) : new Date(),
          notes: tx.notes || '',
          parent_income_id: tx.parent_income_id ?? null,
          _lastModified: tx._lastModified || Date.now(),
          localId: tx.id,
          deleted: !!tx._deleted,
        };

        if (tx._deleted) {
          if (tx._remoteId) {
            await deleteDoc(doc(txCol, tx._remoteId));
          }
          await markTransactionSynced(tx.id, { hardDelete: true });
        } else if (tx._remoteId) {
          await setDoc(
            doc(txCol, tx._remoteId),
            {
              ...baseData,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          await markTransactionSynced(tx.id, { remoteId: tx._remoteId });
        } else {
          const docRef = await addDoc(txCol, {
            ...baseData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await markTransactionSynced(tx.id, { remoteId: docRef.id });
        }

        syncedCount += 1;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[sync] Failed to sync transaction', tx.id, err);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[sync] Completed sync run; synced ${syncedCount} records.`);
  } finally {
    isSyncing = false;
  }
}

// Start periodic background sync and simple lifecycle hooks (online/focus).
// Returns a cleanup function that stops sync.
export function startBackgroundSync({ intervalMs = 60000 } = {}) {
  if (!USE_FIREBASE || hasStarted) {
    return () => {};
  }

  hasStarted = true;

  const run = () => {
    syncPendingToFirebase().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[sync] Unhandled sync error', err);
    });
  };

  // Kick off an initial sync when online.
  if (navigator.onLine) {
    run();
  }

  intervalId = window.setInterval(run, intervalMs);

  window.addEventListener('online', run);
  window.addEventListener('focus', run);

  return () => {
    if (intervalId != null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }

    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
    hasStarted = false;
  };
}
