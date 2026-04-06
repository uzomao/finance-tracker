// Unified data access layer for the app.
//
// Components should always import from this module. Firestore is the single
// source of truth for all reads and writes; real-time listeners elsewhere in
// the app keep UI state up to date.

import * as firebaseDb from './db.firebase';

// Account APIs (Firestore)
export const getAccounts = firebaseDb.getAccounts;
export const getAccount = firebaseDb.getAccount;
export const createAccount = firebaseDb.createAccount;
export const updateAccount = firebaseDb.updateAccount;
export const deleteAccount = firebaseDb.deleteAccount;

// Transaction APIs (Firestore)
export const getTransactions = firebaseDb.getTransactions;
export const createIncomeWithAllocations = firebaseDb.createIncomeWithAllocations;
export const createExpense = firebaseDb.createExpense;
export const updateTransaction = firebaseDb.updateTransaction;
export const importTransactionsBatch = firebaseDb.importTransactionsBatch;
