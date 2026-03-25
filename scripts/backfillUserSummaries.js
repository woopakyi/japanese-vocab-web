const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function isBetterScore(nextEntry, currentEntry) {
  if (!currentEntry) return true;
  if ((nextEntry.score || 0) > (currentEntry.score || 0)) return true;
  if ((nextEntry.score || 0) === (currentEntry.score || 0)) {
    return (nextEntry.totalQuestions || 0) > (currentEntry.totalQuestions || 0);
  }
  return false;
}

async function main() {
  console.log('Starting user summary backfill...');
  const recordsSnap = await db.collection('exerciseRecords').get();

  const summaryByUser = {};

  recordsSnap.forEach((docSnap) => {
    const record = docSnap.data();
    const userId = record.userId;
    const exerciseType = Number(record.exerciseType);

    if (!userId || (exerciseType !== 1 && exerciseType !== 2) || !record.chapterId) {
      return;
    }

    if (!summaryByUser[userId]) {
      summaryByUser[userId] = {};
    }

    const key = `${record.chapterId}-${exerciseType}`;
    const nextEntry = {
      chapterId: record.chapterId,
      exerciseType,
      chapterGroup: record.chapterGroup || '',
      score: Number(record.score) || 0,
      totalQuestions: Number(record.totalQuestions) || 0,
      updatedAtMs: Date.now(),
    };

    if (isBetterScore(nextEntry, summaryByUser[userId][key])) {
      summaryByUser[userId][key] = nextEntry;
    }
  });

  const userIds = Object.keys(summaryByUser);
  console.log(`Preparing updates for ${userIds.length} users...`);

  for (const userId of userIds) {
    await db.collection('users').doc(userId).set(
      {
        bestScoresByChapterType: summaryByUser[userId],
        bestScoresUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log('Backfill complete.');
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
