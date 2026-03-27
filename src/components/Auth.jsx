import React, { useState } from 'react';
import { 
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider, db } from '../config/firebase';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { removeCachedValue } from '../utils/cache';
import { updateUserBestScoreSummary } from '../utils/userSummary';

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-api-key': 'Firebase API key is invalid. Check VITE_FIREBASE_API_KEY in your .env file.',
  'auth/app-not-authorized': 'This app is not authorized in Firebase. Verify your Web App config and Authorized domains.',
  'auth/operation-not-allowed': 'Google sign-in is disabled. Enable Google provider in Firebase Authentication settings.',
  'auth/unauthorized-domain': 'This domain is not authorized. Add your dev/deploy domain in Firebase Auth > Settings > Authorized domains.',
  'auth/popup-blocked': 'Popup was blocked by the browser. Allow popups for this site and try again.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed before completion. Please try again.',
  'auth/network-request-failed': 'Network error while signing in. Check your internet connection and retry.',
};

function formatAuthError(err) {
  if (!err) return 'Login failed. Please try again.';
  if (err.code && AUTH_ERROR_MESSAGES[err.code]) return AUTH_ERROR_MESSAGES[err.code];
  return err.message || 'Login failed. Please try again.';
}

// This function will sync local data to Firestore on login
const syncLocalRecordsToFirestore = async (userId) => {
  const localData = localStorage.getItem('exerciseRecords');
  if (!localData) {
    return;
  }

  const records = JSON.parse(localData);
  if (!Array.isArray(records) || records.length === 0) {
    localStorage.removeItem('exerciseRecords');
    return;
  }

  for (const record of records) {
    await addDoc(collection(db, 'exerciseRecords'), {
      ...record,
      userId,
      syncedFromLocal: true,
      completedAt: serverTimestamp(),
    });
  }

  await updateUserBestScoreSummary(userId, records);

  localStorage.removeItem('exerciseRecords');
};

export default function Auth({ closeModal }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in Firestore, if not, create them
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          createdAt: serverTimestamp(),
        });
      }
      await syncLocalRecordsToFirestore(user.uid);
      removeCachedValue(`records:${user.uid}:all`);
      removeCachedValue(`summary:${user.uid}:best`);
      closeModal();
    } catch (err) {
      setError(formatAuthError(err));
    }
  };

  return (
    <div className="auth-overlay" onClick={closeModal}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={closeModal} aria-label="Close auth modal">X</button>
        <h2 className="auth-title">Login</h2>
        <p className="auth-reminder home-intro">
          If you do not sign in, your exercise records will be stored in this browser only.
          <br />
          <br />
          After you sign in, your exercise records will be moved from this browser to your account.
        </p>
        <button className="google-login-btn" onClick={handleGoogleSignIn}>Continue with Google</button>
        {error && <p className="error-banner" style={{ marginTop: '0.8rem' }}>{error}</p>}
        {message && <p style={{ marginTop: '0.8rem' }}>{message}</p>}
      </div>
    </div>
  );
}