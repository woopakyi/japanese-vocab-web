import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function Exercise() {
  const { chapterId, exerciseType } = useParams();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [chapterData, setChapterData] = useState(null);
  const [error, setError] = useState('');

  // The type of vocabulary to fetch (1 for Kanji, 2 for Katakana)
  const vocabType = parseInt(exerciseType);

  useEffect(() => {
    const fetchExerciseData = async () => {
      setLoading(true);
      try {
        // 1. Fetch chapter details (like its group name)
        const chapterDocRef = doc(db, 'chapters', chapterId);
        const chapterDocSnap = await getDoc(chapterDocRef);
        if (chapterDocSnap.exists()) {
          setChapterData(chapterDocSnap.data());
        } else {
          throw new Error("Chapter not found!");
        }

        // 2. Fetch vocabulary for the exercise
        const vocabCollectionRef = collection(db, 'chapters', chapterId, 'vocabularies');
        const q = query(vocabCollectionRef, orderBy('originalOrder'));
        const querySnapshot = await getDocs(q);

        const questionsData = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((item) => item.type === vocabType);
        setQuestions(questionsData);

        // Initialize userAnswers state
        const initialAnswers = {};
        questionsData.forEach(q => {
          initialAnswers[q.id] = '';
        });
        setUserAnswers(initialAnswers);

      } catch (error) {
        console.error("Error fetching exercise data:", error);
        if (error?.code === 'permission-denied') {
          setError('Cannot load exercise data: Firestore rules block public read access.');
        } else {
          setError('Cannot load exercise data right now.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExerciseData();
  }, [chapterId, vocabType]);

  const handleInputChange = (questionId, value) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let score = 0;
    
    const results = questions.map(q => {
      const userAnswer = userAnswers[q.id] || "";
      let correctAnswer = "";
      let isCorrect = false;

      if (vocabType === 1) { // Kanji to Hiragana
        correctAnswer = q.word;
      } else if (vocabType === 2) { // Meaning to Katakana
        correctAnswer = q.word;
      }
      
      // Simple string comparison for correctness
      if (userAnswer.trim() === correctAnswer.trim()) {
        score++;
        isCorrect = true;
      }

      return {
        question: vocabType === 1 ? q.kanji : q.meaning,
        userAnswer,
        correctAnswer,
        isCorrect,
      };
    });

    const finalResult = {
      score,
      totalQuestions: questions.length,
      chapterId,
      chapterGroup: chapterData.group,
      exerciseType: vocabType,
      results,
    };

    // Navigate to results page and pass the state
    navigate('/results', { state: { finalResult } });
  };

  if (loading) {
    return <div>Loading exercise...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  // This handles your note: "some chapters have no type2 vocabulary"
  if (questions.length === 0) {
    return (
      <div>
        <h1>Exercise for {chapterId.replace('ch', 'Chapter ')}</h1>
        <p>There is no vocabulary for this exercise type in this chapter.</p>
        <button type="button" onClick={() => navigate(-1)} style={{ marginRight: '0.6rem' }}>
          Go Back
        </button>
        <button onClick={() => navigate(`/chapter/${chapterId}`)}>Back to Chapter</button>
      </div>
    );
  }

  return (
    <div className="center-card">
      <button type="button" onClick={() => navigate(-1)} style={{ marginBottom: '0.9rem' }}>
        Go Back
      </button>
      <h1>{`Exercise Type ${vocabType} for ${chapterId.replace('ch', 'Chapter ')}`}</h1>
      <p>{vocabType === 1 ? 'Convert Kanji to Hiragana' : 'Convert Meaning to Katakana'}</p>
      
      <form onSubmit={handleSubmit}>
        {questions.map((q, index) => (
          <div key={q.id} className="question-card">
            <label>
              Q{index + 1}: {vocabType === 1 ? q.kanji : q.meaning}
              <input
                type="text"
                value={userAnswers[q.id] || ''}
                onChange={(e) => handleInputChange(q.id, e.target.value)}
              />
            </label>
          </div>
        ))}
        <button type="submit">Finish & See Results</button>
      </form>
    </div>
  );
}