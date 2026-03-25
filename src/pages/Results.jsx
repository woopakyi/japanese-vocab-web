import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth(); // Get current user status
  const hasSaved = useRef(false);

  // Get results passed from Exercise.jsx
  const { finalResult } = location.state || {};

  // If someone navigates here directly, redirect them.
  useEffect(() => {
    if (!finalResult) {
      navigate('/');
      return;
    }

    // Wait for auth state before deciding storage target.
    if (authLoading) {
      return;
    } else if (!hasSaved.current) {
      hasSaved.current = true;
      saveRecord();
    }
  }, [finalResult, navigate, user, authLoading]);

  const saveRecord = async () => {
    if (!finalResult) return;

    const record = {
      ...finalResult,
      completedAt: new Date().toISOString(), // Use ISO string for both storage types
    };
    
    if (user) {
      // User is logged in, save to Firestore
      try {
        await addDoc(collection(db, 'exerciseRecords'), {
          ...record,
          userId: user.uid,
          completedAt: serverTimestamp() // Use Firestore's server time
        });
        console.log("Record saved to Firestore.");
      } catch (error) {
        console.error("Error saving record to Firestore:", error);
      }
    } else {
      // User is not logged in, save to Local Storage
      try {
        const localRecords = JSON.parse(localStorage.getItem('exerciseRecords')) || [];
        localRecords.push(record);
        localStorage.setItem('exerciseRecords', JSON.stringify(localRecords));
        console.log("Record saved to Local Storage.");
      } catch (error) {
        console.error("Error saving record to Local Storage:", error);
      }
    }
  };


  if (!finalResult) {
    return <div>Loading results...</div>; // Or redirect
  }

  const { score, totalQuestions, results } = finalResult;

  return (
    <div>
      <div className="exercise-top-row">
        <button type="button" className="go-back-btn" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
      <h1>Your Results</h1>
      <h2>Score: {score} / {totalQuestions}</h2>

      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th>Your Answer</th>
            <th>Correct Answer</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((res, index) => (
            <tr key={index}>
              <td>{res.question}</td>
              <td>
                <span className={res.isCorrect ? 'record-status-correct' : 'record-status-wrong'}>
                  {res.userAnswer || '--'}
                </span>
              </td>
              <td>
                <span className={res.isCorrect ? 'record-status-correct' : 'record-status-wrong'}>
                  {res.correctAnswer}
                </span>
              </td>
              <td>
                <strong className={res.isCorrect ? 'record-status-correct' : 'record-status-wrong'}>
                  {res.isCorrect ? 'Correct' : 'Incorrect'}
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}