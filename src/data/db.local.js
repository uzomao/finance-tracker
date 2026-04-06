import { openDB } from 'idb';

const DB_NAME = 'finance-tracker';
const DB_VERSION = 1;

const STORES = {
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
};

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
        const accountStore = db.createObjectStore(STORES.ACCOUNTS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        accountStore.createIndex('by-name', 'name');
      }
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.TRANSACTIONS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        txStore.createIndex('by-date', 'date');
      }
    },
  });
}

// Account APIs
export async function getAccounts() {
  const db = await getDb();
  const all = await db.getAll(STORES.ACCOUNTS);
  // Hide soft-deleted accounts from the app UI.
  return all.filter((acc) => !acc._deleted);
}

export async function getAccount(id) {
  const db = await getDb();
  return db.get(STORES.ACCOUNTS, Number(id));
}

export async function createAccount({ name, percentage, keywords = '' }) {
  const db = await getDb();
  const now = Date.now();
  const record = {
    name,
    percentage,
    keywords,
    // Local-first sync metadata
    _pendingSync: true,
    _lastModified: now,
    _remoteId: null,
  };
  const id = await db.add(STORES.ACCOUNTS, record);
  return { id, ...record };
}

export async function updateAccount(id, { name, percentage, keywords = '' }) {
  const db = await getDb();
  const existing = await db.get(STORES.ACCOUNTS, Number(id));
  if (!existing) return null;
  const updated = {
    ...existing,
    name,
    percentage,
    keywords,
    _pendingSync: true,
    _lastModified: Date.now(),
  };
  await db.put(STORES.ACCOUNTS, updated);
  return updated;
}

export async function deleteAccount(id) {
  const db = await getDb();
  const existing = await db.get(STORES.ACCOUNTS, Number(id));
  if (!existing) {
    return;
  }

  // Soft-delete so that the background sync service can propagate the
  // deletion to Firebase. The app-level getAccounts() call hides deleted
  // records.
  const updated = {
    ...existing,
    _deleted: true,
    _pendingSync: true,
    _lastModified: Date.now(),
  };

  await db.put(STORES.ACCOUNTS, updated);
}

// Transaction APIs
export async function getTransactions() {
  const db = await getDb();
  const allTxs = await db.getAll(STORES.TRANSACTIONS);
  const txs = allTxs.filter((t) => !t._deleted);
  const accounts = await db.getAll(STORES.ACCOUNTS);
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  return txs
    .map((t) => ({
      ...t,
      account_name: t.account_id ? accountMap.get(t.account_id) || null : null,
    }))
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const dbt = b.date ? new Date(b.date).getTime() : 0;
      if (dbt !== da) return dbt - da;
      return (b.id || 0) - (a.id || 0);
    });
}

export async function createIncomeWithAllocations({ amount, description = '', notes, date, allocations }) {
  const db = await getDb();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const when = date || now;
  const tx = db.transaction([STORES.TRANSACTIONS, STORES.ACCOUNTS], 'readwrite');
  const txStore = tx.objectStore(STORES.TRANSACTIONS);
  const accountsStore = tx.objectStore(STORES.ACCOUNTS);

  const totalIncomeId = await txStore.add({
    amount,
    description,
    type: 'income',
    account_id: null,
    date: when,
    notes: notes || '',
    _pendingSync: true,
    _lastModified: nowMs,
    _remoteId: null,
  });

  const accounts = await accountsStore.getAll();

  let allocationsToSave;

  if (Array.isArray(allocations) && allocations.length > 0) {
    // Use custom per-transaction allocation breakdown supplied by the caller
    allocationsToSave = allocations.map((alloc) => ({
      amount: alloc.amount,
      account_id: alloc.account_id,
      description: 'Income allocation',
      type: 'income',
      date: when,
      notes: '',
      parent_income_id: totalIncomeId,
      _pendingSync: true,
      _lastModified: nowMs,
      _remoteId: null,
    }));
  } else {
    // Fall back to default account percentage-based allocations
    allocationsToSave = accounts.map((account) => {
      const allocated = (amount * account.percentage) / 100;
      return {
        amount: allocated,
        account_id: account.id,
        description: 'Income allocation',
        type: 'income',
        date: when,
        notes: '',
        parent_income_id: totalIncomeId,
        _pendingSync: true,
        _lastModified: nowMs,
        _remoteId: null,
      };
    });
  }

  for (const alloc of allocationsToSave) {
    await txStore.add(alloc);
  }

  await tx.done;

  return {
    totalIncomeId,
    allocations: allocationsToSave,
  };
}

export async function createExpense({ amount, description = '', account_id, notes = '', date }) {
  const db = await getDb();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const when = date || now;
  const id = await db.add(STORES.TRANSACTIONS, {
    amount,
    description,
    type: 'expense',
    account_id: Number(account_id),
    date: when,
    notes,
    _pendingSync: true,
    _lastModified: nowMs,
    _remoteId: null,
  });
  return { id, amount, description, type: 'expense', account_id: Number(account_id), notes };
}

export async function updateTransaction(id, updates) {
  const db = await getDb();
  const existing = await db.get(STORES.TRANSACTIONS, Number(id));
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    _pendingSync: true,
    _lastModified: Date.now(),
  };

  await db.put(STORES.TRANSACTIONS, updated);
  return updated;
}

// ----- Sync helper APIs -----

export async function getPendingAccounts() {
  const db = await getDb();
  const all = await db.getAll(STORES.ACCOUNTS);
  return all.filter((acc) => acc._pendingSync);
}

export async function getPendingTransactions() {
  const db = await getDb();
  const all = await db.getAll(STORES.TRANSACTIONS);
  return all.filter((tx) => tx._pendingSync);
}

export async function markAccountSynced(id, { remoteId, hardDelete } = {}) {
  const db = await getDb();
  const key = Number(id);
  const existing = await db.get(STORES.ACCOUNTS, key);
  if (!existing) return;

  if (hardDelete || existing._deleted) {
    await db.delete(STORES.ACCOUNTS, key);
    return;
  }

  const updated = {
    ...existing,
    _pendingSync: false,
    _remoteId: remoteId ?? existing._remoteId ?? null,
  };

  await db.put(STORES.ACCOUNTS, updated);
}

export async function markTransactionSynced(id, { remoteId, hardDelete } = {}) {
  const db = await getDb();
  const key = Number(id);
  const existing = await db.get(STORES.TRANSACTIONS, key);
  if (!existing) return;

  if (hardDelete || existing._deleted) {
    await db.delete(STORES.TRANSACTIONS, key);
    return;
  }

  const updated = {
    ...existing,
    _pendingSync: false,
    _remoteId: remoteId ?? existing._remoteId ?? null,
  };

  await db.put(STORES.TRANSACTIONS, updated);
}

