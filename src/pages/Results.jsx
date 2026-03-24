import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth(); // Get current user status
  const hasSaved = useRef(false);

  // Get results passed from Exercise.jsx
  const { finalResult } = location.state || {};

  // If someone navigates here directly, redirect them.
  useEffect(() => {
    if (!finalResult) {
      navigate('/');
    } else if (!hasSaved.current) {
      hasSaved.current = true;
      saveRecord();
    }
  }, [finalResult, navigate, user]);

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
            <tr key={index} className={res.isCorrect ? 'result-row-correct' : 'result-row-wrong'}>
              <td>{res.question}</td>
              <td>{res.userAnswer}</td>
              <td>{res.correctAnswer}</td>
              <td>{res.isCorrect ? 'Correct' : 'Incorrect'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="action-row" style={{ marginTop: '1.2rem' }}>
        <Link to={`/chapter/${finalResult.chapterId}`}>Back to Chapter</Link>
        <Link to="/">Back to Home</Link>
      </div>
    </div>
  );
}