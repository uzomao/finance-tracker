import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { USE_FIREBASE, firebaseConfig } from '../config';

// Centralised Firebase client initialisation.
//
// When USE_FIREBASE is false or firebaseConfig is missing/invalid, we do not
// initialise Firebase and any caller should treat Firebase as disabled.

let app = null;
let auth = null;
let db = null;

const hasFirebaseConfig =
  !!firebaseConfig &&
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.appId;

if (USE_FIREBASE && hasFirebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else if (USE_FIREBASE) {
  // Feature flag is on but config is incomplete – log once for developers.
  // The rest of the app will continue to work against IndexedDB only.
  // eslint-disable-next-line no-console
  console.warn('[firebase] USE_FIREBASE is true but Firebase config is incomplete; remote sync is disabled.');
}

export { auth, db };

let userIdPromise;

export function getCurrentUserId() {
  if (!USE_FIREBASE || !auth) {
    return Promise.reject(new Error('Firebase is disabled or not configured.'));
  }

  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser.uid);
  }
  return Promise.reject(new Error('No authenticated user.'));
}
