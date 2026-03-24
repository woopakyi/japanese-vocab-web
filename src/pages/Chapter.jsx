import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function Chapter() {
  const { chapterId } = useParams();
  const [vocab, setVocab] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'kanji', 'katakana'
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVocab = async () => {
      setLoading(true);
      try {
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
  }, [chapterId]);

  const filteredVocab = useMemo(() => {
    if (filter === 'kanji') {
      return vocab.filter(v => v.type === 1);
    }
    if (filter === 'katakana') {
      return vocab.filter(v => v.type === 2);
    }
    return vocab;
  }, [vocab, filter]);

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
        <strong>Exercises:</strong>
        <Link className="pill-link" to={`/exercise/${chapterId}/1`}>Kanji to Hiragana (Type 1)</Link>
        <Link className="pill-link" to={`/exercise/${chapterId}/2`}>Meaning to Katakana (Type 2)</Link>
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
            <th>Hiragana / Katakana</th>
            <th>Kanji</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {filteredVocab.map(v => (
            <tr key={v.id}>
              <td>{v.word}</td>
              <td>{v.kanji}</td>
              <td>{v.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}