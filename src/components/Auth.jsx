import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider, db } from '../config/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// This function will sync local data to Firestore on login
const syncLocalRecordsToFirestore = async (userId) => {
    const localData = localStorage.getItem('exerciseRecords');
    if (localData) {
        const records = JSON.parse(localData);
        console.log(`Found ${records.length} local records to sync.`);
        
        for (const record of records) {
            // Here you would add the record to the `exerciseRecords` collection in Firestore
            // This is a simplified example. You'd likely want to use addDoc.
            console.log("Syncing record for chapter:", record.chapterId);
            // Example: await addDoc(collection(db, 'exerciseRecords'), { ...record, userId });
        }
        
        // Clear local storage after successful sync
        localStorage.removeItem('exerciseRecords');
        console.log("Local records cleared after sync.");
    }
};

export default function Auth({ closeModal }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create a user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.email.split('@')[0], // a default display name
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

  return (
    <div className="auth-overlay" onClick={closeModal}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={closeModal} aria-label="Close auth modal">X</button>
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        <form onSubmit={handleAuthAction}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>
        </form>
        <hr className="auth-divider" />
        <button onClick={handleGoogleSignIn}>Sign in with Google</button>
        <hr className="auth-divider" />
        <button onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
        </button>
        {error && <p className="error-banner" style={{ marginTop: '0.8rem' }}>{error}</p>}
      </div>
    </div>
  );
}