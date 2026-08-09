/* Firebase Authentication client.
   The Firebase compat SDK is loaded in index.html so this project does not
   need another package install just to provide authentication. */

declare global {
  interface Window {
    firebase?: any;
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn('Firebase client configuration is incomplete. Add the VITE_FIREBASE_* values to .env.');
}

if (!window.firebase) {
  throw new Error('Firebase SDK did not load. Check the Firebase scripts in index.html.');
}

const app = window.firebase.apps.length
  ? window.firebase.app()
  : window.firebase.initializeApp(firebaseConfig);

export const firebaseAuth = window.firebase.auth(app);
export const firebaseGoogleProvider = new window.firebase.auth.GoogleAuthProvider();
