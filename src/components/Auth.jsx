import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider, db } from '../config/firebase';
import { collection, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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

  localStorage.removeItem('exerciseRecords');
};

export default function Auth({ closeModal }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) {
          setError('Please enter your name.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }

        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name.trim() });

        // Create a user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: name.trim(),
          createdAt: serverTimestamp(),
        });
      }
      await syncLocalRecordsToFirestore(userCredential.user.uid);
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

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
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Enter your email above, then click Forgot Password.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-overlay" onClick={closeModal}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={closeModal} aria-label="Close auth modal">X</button>
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        <form onSubmit={handleAuthAction}>
          {!isLogin && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              required
            />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          {!isLogin && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
            />
          )}
          <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>
        </form>
        {isLogin && (
          <button type="button" className="small-link-btn" onClick={handleForgotPassword}>
            Forgot Password?
          </button>
        )}
        <hr className="auth-divider" />
        <button onClick={handleGoogleSignIn}>Sign in with Google</button>
        <hr className="auth-divider" />
        <button onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
        </button>
        {error && <p className="error-banner" style={{ marginTop: '0.8rem' }}>{error}</p>}
        {message && <p style={{ marginTop: '0.8rem' }}>{message}</p>}
      </div>
    </div>
  );
}