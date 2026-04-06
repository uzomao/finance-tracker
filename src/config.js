// Global app configuration and feature flags.
//
// Firebase configuration is provided via Vite environment variables.
// To enable Firebase background sync, add the following to your .env file
// (or .env.local) and set VITE_USE_FIREBASE="true":
//
//   VITE_USE_FIREBASE=true
//   VITE_FIREBASE_API_KEY=your-api-key
//   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
//   VITE_FIREBASE_PROJECT_ID=your-project-id
//   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
//   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
//   VITE_FIREBASE_APP_ID=your-app-id
//
// When VITE_USE_FIREBASE is false or missing, the app works fully offline
// against IndexedDB only and all Firebase sync becomes a no-op.

export const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

// Firebase web SDK config object. When Firebase is disabled or config values
// are missing, this will be null and no Firebase calls will be made.
export const firebaseConfig = USE_FIREBASE
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }
  : null;
