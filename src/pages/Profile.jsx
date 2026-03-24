import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import HexagonChart from '../components/HexagonChart';

export default function Profile() {
  const { user } = useAuth();
  const [scores, setScores] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchScores = async () => {
      const q = query(collection(db, 'exerciseRecords'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const userRecords = querySnapshot.docs.map(doc => doc.data());
      
      const scoreByGroup = {
        "Japanese I": 0,
        "Japanese II": 0,
        "Japanese III": 0,
        "Japanese IV": 0,
        "Japanese V": 0,
        "Japanese VI": 0,
      };

      let overallTotal = 0;

      userRecords.forEach(record => {
        if (scoreByGroup.hasOwnProperty(record.chapterGroup)) {
          scoreByGroup[record.chapterGroup] += record.score;
        }
        overallTotal += record.score;
      });

      setScores(scoreByGroup);
      setTotalScore(overallTotal);
      setLoading(false);
    };

    fetchScores();
  }, [user]);

  if (loading) {
    return <div>Loading profile data...</div>;
  }
  
  return (
    <div className="center-card">
      <h1>{user.displayName || user.email}'s Profile</h1>
      <h2>Total Score Across All Chapters: {totalScore}</h2>
      
      <div style={{ marginTop: '1.5rem' }}>
        <h3>Score Distribution by Group</h3>
        {scores && <HexagonChart scoreData={scores} />}
      </div>
    </div>
  );
}