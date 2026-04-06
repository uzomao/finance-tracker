// Unified data access layer for the app.
//
// Components should always import from this module. All reads and writes go
// to IndexedDB first for speed and offline support. A separate background
// sync service is responsible for pushing pending changes to Firebase when
// enabled.

import * as localDb from './db.local';

// Account APIs (IndexedDB-first)
export const getAccounts = localDb.getAccounts;
export const getAccount = localDb.getAccount;
export const createAccount = localDb.createAccount;
export const updateAccount = localDb.updateAccount;
export const deleteAccount = localDb.deleteAccount;

// Transaction APIs (IndexedDB-first)
export const getTransactions = localDb.getTransactions;
export const createIncomeWithAllocations = localDb.createIncomeWithAllocations;
export const createExpense = localDb.createExpense;
export const updateTransaction = localDb.updateTransaction;

// Sync helper APIs, used by the background sync service. These are safe to
// re-export as they don't change any existing component behaviour.
export const getPendingAccounts = localDb.getPendingAccounts;
export const getPendingTransactions = localDb.getPendingTransactions;
export const markAccountSynced = localDb.markAccountSynced;
export const markTransactionSynced = localDb.markTransactionSynced;
