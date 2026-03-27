// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const normalizeAuthDomain = (value) => {
  if (!value) return value;
  const trimmed = value.trim();

  // Accept both "project.firebaseapp.com" and full URLs from copied console values.
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).host;
    } catch {
      return trimmed;
    }
  }

  return trimmed.replace(/\/$/, "");
};

const normalizeStorageBucket = (value) => {
  if (!value) return value;
  const trimmed = value.trim();
  return trimmed.replace(/^gs:\/\//, "").replace(/\/$/, "");
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: normalizeAuthDomain(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: normalizeStorageBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim(),
};

if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId
) {
  throw new Error(
    "Missing Firebase environment variables. Check .env file and VITE_FIREBASE_* values."
  );
}

if (firebaseConfig.authDomain.includes("/")) {
  throw new Error(
    "Invalid VITE_FIREBASE_AUTH_DOMAIN. Use only the hostname, for example: your-project.firebaseapp.com"
  );
}

if (!firebaseConfig.authDomain.includes(".")) {
  throw new Error(
    "Invalid VITE_FIREBASE_AUTH_DOMAIN. It must be a full hostname like your-project.firebaseapp.com"
  );
}

if (!/^\d+$/.test(firebaseConfig.messagingSenderId)) {
  throw new Error(
    "Invalid VITE_FIREBASE_MESSAGING_SENDER_ID. It must be numeric (for example: 123456789012)."
  );
}


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
