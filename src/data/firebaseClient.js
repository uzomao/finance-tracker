import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2mVJVssfc286VdvFt3HjrEo2lsBeN3lw",
  authDomain: "finance-tracker-9628f.firebaseapp.com",
  projectId: "finance-tracker-9628f",
  storageBucket: "finance-tracker-9628f.firebasestorage.app",
  messagingSenderId: "314146909646",
  appId: "1:314146909646:web:a794161bda64bfac674f9f"
};

// Only initialize if config has been filled out (basic guard for development)
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

let userIdPromise;

export function getCurrentUserId() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser.uid);
  }

  if (!userIdPromise) {
    userIdPromise = signInAnonymously(auth).then((cred) => cred.user.uid);
  }

  return userIdPromise;
}
