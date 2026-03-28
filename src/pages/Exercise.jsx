import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCachedValue, setCachedValue } from '../utils/cache';
import { loadStaticChapterMeta, loadStaticChapterVocab } from '../utils/staticContent';

const CHAPTER_META_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VOCAB_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
        const chapterMetaCacheKey = `chapter:${chapterId}:meta`;
        const cachedChapterMeta = getCachedValue(chapterMetaCacheKey, CHAPTER_META_CACHE_TTL_MS);
        const chapterMeta = cachedChapterMeta || await (async () => {
          const data = await loadStaticChapterMeta(chapterId);
          if (!data) {
            throw new Error('Chapter not found!');
          }
          setCachedValue(chapterMetaCacheKey, data);
          return data;
        })();
        setChapterData(chapterMeta);

        // 2. Fetch vocabulary for the exercise
        const vocabCacheKey = `chapter:${chapterId}:vocab`;
        const allVocab = getCachedValue(vocabCacheKey, VOCAB_CACHE_TTL_MS) || await (async () => {
          const data = await loadStaticChapterVocab(chapterId);
          setCachedValue(vocabCacheKey, data);
          return data;
        })();

        const questionsData = allVocab
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
        setError('Cannot load exercise data right now.');
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
      } else if (vocabType === 2) { // English to Katakana
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

    const attemptId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const finalResult = {
      attemptId,
      completedAt: new Date().toISOString(),
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
    <div>
      <div className="exercise-top-row">
        <button type="button" className="go-back-btn" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
      <div className="center-card">
      <h1>{`Exercise Type ${vocabType} for ${chapterId.replace('ch', 'Chapter ')}`}</h1>
      <p>{vocabType === 1 ? 'Convert Kanji to Hiragana. No punctuation or special characters are required in the answer.' : 'Convert English to Katakana. No punctuation or special characters are required in the answer.'}</p>
      
      <form onSubmit={handleSubmit}>
        {questions.map((q, index) => (
          <div key={q.id} className="question-card exercise-question-item">
            <div className="question-prompt-card">
              Q{index + 1}: {vocabType === 1 ? q.kanji : q.meaning}
            </div>
            <label className="answer-input-area">
              Your Answer
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
    </div>
  );
}