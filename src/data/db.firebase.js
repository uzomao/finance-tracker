import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseClient';
import { getActiveProfileId } from './profileService';

// Helper to normalise Firestore timestamps to ISO strings
function normaliseDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return value;
}

// ----- Account APIs (Firestore) -----

export async function getAccounts() {
  const profileId = await getActiveProfileId();
  const colRef = collection(db, 'profiles', profileId, 'accounts');
  const snap = await getDocs(colRef);
  const accounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Simple sort by createdAt if present, else by name
  accounts.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?.seconds ?? 0;
    if (tb !== ta) return tb - ta;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return accounts;
}

export async function getAccount(id) {
  const profileId = await getActiveProfileId();
  const ref = doc(db, 'profiles', profileId, 'accounts', String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createAccount({ name, percentage, keywords = '' }) {
  const profileId = await getActiveProfileId();
  const colRef = collection(db, 'profiles', profileId, 'accounts');
  const data = {
    name,
    percentage,
    keywords,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(colRef, data);
  // Return the data we just wrote; Firestore will fill timestamps server-side.
  return { id: docRef.id, ...data };
}

export async function updateAccount(id, { name, percentage, keywords = '' }) {
  const profileId = await getActiveProfileId();
  const ref = doc(db, 'profiles', profileId, 'accounts', String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  await updateDoc(ref, {
    name,
    percentage,
    keywords,
    updatedAt: serverTimestamp(),
  });

  const updatedSnap = await getDoc(ref);
  return { id: updatedSnap.id, ...updatedSnap.data() };
}

export async function deleteAccount(id) {
  const profileId = await getActiveProfileId();
  const ref = doc(db, 'profiles', profileId, 'accounts', String(id));
  await deleteDoc(ref);
}

// ----- Transaction APIs (Firestore) -----

export async function getTransactions() {
  const profileId = await getActiveProfileId();
  const txCol = collection(db, 'profiles', profileId, 'transactions');
  const accCol = collection(db, 'profiles', profileId, 'accounts');

  const [txSnap, accSnap] = await Promise.all([
    getDocs(txCol),
    getDocs(accCol),
  ]);

  const accounts = accSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  const txs = txSnap.docs.map((d) => {
    const data = d.data();
    const date = normaliseDate(data.date);
    return {
      id: d.id,
      ...data,
      date,
      account_name:
        data.account_id && accountMap.get(data.account_id)
          ? accountMap.get(data.account_id)
          : null,
    };
  });

  // Sort like the IndexedDB version: by date desc, then id desc
  txs.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const dbt = b.date ? new Date(b.date).getTime() : 0;
    if (dbt !== da) return dbt - da;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  return txs;
}

export async function createIncomeWithAllocations({
  amount,
  description = '',
  notes,
  date,
  allocations,
}) {
  const profileId = await getActiveProfileId();
  const txCol = collection(db, 'profiles', profileId, 'transactions');

  const now = new Date().toISOString();
  const whenIso = date || now;
  const whenDate = new Date(whenIso);

  // Parent income transaction
  const parentRef = await addDoc(txCol, {
    amount,
    description,
    type: 'income',
    account_id: null,
    date: whenDate,
    notes: notes || '',
    createdAt: serverTimestamp(),
  });

  let allocationsToSave;

  if (Array.isArray(allocations) && allocations.length > 0) {
    // Use custom per-transaction allocation breakdown supplied by the caller
    allocationsToSave = allocations.map((alloc) => ({
      amount: alloc.amount,
      account_id: alloc.account_id,
      description: 'Income allocation',
      type: 'income',
      date: whenDate,
      notes: '',
      parent_income_id: parentRef.id,
      createdAt: serverTimestamp(),
    }));
  } else {
    // If no explicit allocations were provided, fall back to account percentages
    const accCol = collection(db, 'profiles', profileId, 'accounts');
    const accSnap = await getDocs(accCol);
    const accounts = accSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    allocationsToSave = accounts.map((account) => ({
      amount: (amount * (account.percentage || 0)) / 100,
      account_id: account.id,
      description: 'Income allocation',
      type: 'income',
      date: whenDate,
      notes: '',
      parent_income_id: parentRef.id,
      createdAt: serverTimestamp(),
    }));
  }

  const createdAllocs = [];
  for (const alloc of allocationsToSave) {
    const docRef = await addDoc(txCol, alloc);
    createdAllocs.push({ id: docRef.id, ...alloc });
  }

  return {
    totalIncomeId: parentRef.id,
    allocations: createdAllocs,
  };
}

export async function createExpense({ amount, description = '', account_id, notes = '', date }) {
  const profileId = await getActiveProfileId();
  const txCol = collection(db, 'profiles', profileId, 'transactions');

  const now = new Date().toISOString();
  const whenIso = date || now;
  const whenDate = new Date(whenIso);

  const docRef = await addDoc(txCol, {
    amount,
    description,
    type: 'expense',
    account_id: account_id != null ? String(account_id) : null,
    date: whenDate,
    notes,
    createdAt: serverTimestamp(),
  });

  const snap = await getDoc(docRef);
  const data = snap.data();

  return {
    id: docRef.id,
    amount: data.amount,
    description: data.description,
    type: data.type,
    account_id: data.account_id,
    notes: data.notes,
    date: normaliseDate(data.date),
  };
}

export async function updateTransaction(id, updates) {
  const profileId = await getActiveProfileId();
  const ref = doc(db, 'profiles', profileId, 'transactions', String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const patch = { ...updates };

  if (patch.date) {
    // Normalise any string date to a JS Date so Firestore stores a Timestamp
    patch.date = new Date(patch.date);
  }

  await updateDoc(ref, patch);

  const updatedSnap = await getDoc(ref);
  const data = updatedSnap.data();

  return {
    id: updatedSnap.id,
    ...data,
    date: normaliseDate(data.date),
  };
}

export async function importTransactionsBatch(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { count: 0 };
  }

  const profileId = await getActiveProfileId();
  const txCol = collection(db, 'profiles', profileId, 'transactions');
  const batch = writeBatch(db);

  rows.forEach((row) => {
    let whenDate;
    if (row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      const [y, m, d] = row.date.split('-').map((part) => Number(part));
      whenDate = new Date(Date.UTC(y, m - 1, d));
    } else if (row.date) {
      const parsed = new Date(row.date);
      whenDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      whenDate = new Date();
    }
    const amount = Number(row.amount) || 0;
    const description = row.description || '';
    const accountId = row.account_id != null ? String(row.account_id) : null;
    const notes = row.notes || '';

    const ref = doc(txCol);
    batch.set(ref, {
      amount,
      description,
      type: 'expense',
      account_id: accountId,
      date: whenDate,
      notes,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();

  return { count: rows.length };
}
