import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';

export default function Chapter() {
  const { chapterId } = useParams();
  const { user } = useAuth();
  const [vocab, setVocab] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'kanji', 'katakana'
  const [bestScores, setBestScores] = useState({ ex1: null, ex2: null });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVocab = async () => {
      setLoading(true);
      try {
        let records = [];
        if (user) {
          const recordQuery = query(
            collection(db, 'exerciseRecords'),
            where('userId', '==', user.uid),
            where('chapterId', '==', chapterId)
          );
          const recordsSnapshot = await getDocs(recordQuery);
          records = recordsSnapshot.docs.map(doc => doc.data());
        } else {
          records = (JSON.parse(localStorage.getItem('exerciseRecords') || '[]'))
            .filter((record) => record.chapterId === chapterId);
        }

        const ex1Scores = records.filter((record) => record.exerciseType === 1).map((record) => record.score);
        const ex2Scores = records.filter((record) => record.exerciseType === 2).map((record) => record.score);
        setBestScores({
          ex1: ex1Scores.length ? Math.max(...ex1Scores) : null,
          ex2: ex2Scores.length ? Math.max(...ex2Scores) : null,
        });

        const vocabCollectionRef = collection(db, 'chapters', chapterId, 'vocabularies');
        const q = query(vocabCollectionRef, orderBy('originalOrder'));
        const querySnapshot = await getDocs(q);
        const vocabData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setVocab(vocabData);
      } catch (error) {
        console.error("Error fetching vocabulary:", error);
        if (error?.code === 'permission-denied') {
          setError('Cannot load chapter vocabulary: Firestore rules block public read access.');
        } else {
          setError('Cannot load chapter vocabulary right now.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchVocab();
  }, [chapterId, user]);

  const filteredVocab = useMemo(() => {
    if (filter === 'kanji') {
      return vocab.filter(v => v.type === 1);
    }
    if (filter === 'katakana') {
      return vocab.filter(v => v.type === 2);
    }
    return vocab;
  }, [vocab, filter]);

  const exerciseMaxMarks = useMemo(() => {
    return {
      ex1: vocab.filter((item) => item.type === 1).length,
      ex2: vocab.filter((item) => item.type === 2).length,
    };
  }, [vocab]);

  if (loading) {
    return <div>Loading vocabulary for {chapterId}...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  return (
    <div>
      <h1>Vocabulary for {chapterId.replace('ch', 'Chapter ')}</h1>

      <div className="action-row">
        <strong>Highest Marks:</strong>
        <div className="highest-marks-list">
          <span>
            Exercise 1: {bestScores.ex1 ?? <span className="placeholder-mark">--</span>}/{exerciseMaxMarks.ex1 || <span className="placeholder-mark">--</span>}
          </span>
          <span>
            Exercise 2: {bestScores.ex2 ?? <span className="placeholder-mark">--</span>}/{exerciseMaxMarks.ex2 || <span className="placeholder-mark">--</span>}
          </span>
        </div>
        <Link className="pill-link" to={`/records?chapterId=${chapterId}`}>View Past Attempts</Link>
      </div>
      
      <div className="action-row">
        <strong>Exercises:</strong>
        <Link className="exercise-link exercise-link-grey" to={`/exercise/${chapterId}/1`}>Exercise 1: Kanji to Hiragana</Link>
        <Link className="exercise-link exercise-link-grey" to={`/exercise/${chapterId}/2`}>Exercise 2: Meaning to Katakana</Link>
      </div>

      <div className="action-row">
        <strong>Filter:</strong>
        <button onClick={() => setFilter('all')} disabled={filter === 'all'}>All</button>
        <button onClick={() => setFilter('kanji')} disabled={filter === 'kanji'}>Kanji</button>
        <button onClick={() => setFilter('katakana')} disabled={filter === 'katakana'}>Katakana</button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>{filter === 'katakana' ? 'Katakana' : 'Hiragana / Katakana'}</th>
            {filter !== 'katakana' && <th>Kanji</th>}
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {filteredVocab.map(v => (
            <tr key={v.id}>
              <td>{v.word}</td>
              {filter !== 'katakana' && <td>{v.kanji}</td>}
              <td>{v.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}