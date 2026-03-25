import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

function normalizeExerciseType(value) {
  const numeric = Number(value);
  return numeric === 1 || numeric === 2 ? numeric : null;
}

function toSummaryEntry(record) {
  const exerciseType = normalizeExerciseType(record.exerciseType);
  if (!record?.chapterId || !exerciseType) {
    return null;
  }

  return {
    chapterId: record.chapterId,
    exerciseType,
    chapterGroup: record.chapterGroup || '',
    score: Number(record.score) || 0,
    totalQuestions: Number(record.totalQuestions) || 0,
    updatedAtMs: Date.now(),
  };
}

function summaryKey(chapterId, exerciseType) {
  return `${chapterId}-${exerciseType}`;
}

function isBetterScore(nextEntry, currentEntry) {
  if (!currentEntry) return true;
  if ((nextEntry.score || 0) > (currentEntry.score || 0)) return true;
  if ((nextEntry.score || 0) === (currentEntry.score || 0)) {
    return (nextEntry.totalQuestions || 0) > (currentEntry.totalQuestions || 0);
  }
  return false;
}

export async function getUserBestScoreSummary(uid) {
  if (!uid) return {};

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return {};
  }

  return userSnap.data()?.bestScoresByChapterType || {};
}

export async function updateUserBestScoreSummary(uid, records) {
  if (!uid || !Array.isArray(records) || records.length === 0) {
    return false;
  }

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const existingSummary = userSnap.exists() ? (userSnap.data()?.bestScoresByChapterType || {}) : {};

  const nextSummary = { ...existingSummary };
  let changed = false;

  records.forEach((record) => {
    const entry = toSummaryEntry(record);
    if (!entry) return;

    const key = summaryKey(entry.chapterId, entry.exerciseType);
    if (isBetterScore(entry, nextSummary[key])) {
      nextSummary[key] = entry;
      changed = true;
    }
  });

  if (!changed) {
    return false;
  }

  await setDoc(
    userRef,
    {
      bestScoresByChapterType: nextSummary,
      bestScoresUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}