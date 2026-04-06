import { USE_FIREBASE } from './dataSourceConfig';
import * as localDb from './db.local';
import * as firebaseDb from './db.firebase';

// Simple runtime switch between IndexedDB (local) and Firebase (cloud).
const impl = USE_FIREBASE ? firebaseDb : localDb;

// Re-export a stable API surface so components don't need to change imports.

// Account APIs
export const getAccounts = impl.getAccounts;
export const getAccount = impl.getAccount;
export const createAccount = impl.createAccount;
export const updateAccount = impl.updateAccount;
export const deleteAccount = impl.deleteAccount;

// Transaction APIs
export const getTransactions = impl.getTransactions;
export const createIncomeWithAllocations = impl.createIncomeWithAllocations;
export const createExpense = impl.createExpense;
export const updateTransaction = impl.updateTransaction;
