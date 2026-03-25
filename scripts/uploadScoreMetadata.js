const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const chapterGroups = {
  'Japanese I': { start: 1, end: 6 },
  'Japanese II': { start: 7, end: 12 },
  'Japanese III': { start: 13, end: 19 },
  'Japanese IV': { start: 20, end: 25 },
  'Japanese V': { start: 26, end: 32 },
  'Japanese VI': { start: 33, end: 38 },
};

function getChapterGroup(chapterNumber) {
  for (const groupName in chapterGroups) {
    const group = chapterGroups[groupName];
    if (chapterNumber >= group.start && chapterNumber <= group.end) {
      return groupName;
    }
  }
  return 'Unknown Group';
}

function readChapterCounts(chapterNumber) {
  return new Promise((resolve, reject) => {
    const chapterId = `ch${chapterNumber}`;
    const csvFilePath = path.join(__dirname, 'data', `${chapterId}.csv`);

    if (!fs.existsSync(csvFilePath)) {
      resolve(null);
      return;
    }

    let type1Count = 0;
    let type2Count = 0;

    fs.createReadStream(csvFilePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            header ? header.replace(/^\uFEFF/, '').trim().toLowerCase() : header,
        })
      )
      .on('data', (row) => {
        if (row.kanji && row.kanji.trim() !== '') {
          type1Count += 1;
        } else if (row.katakana === '1') {
          type2Count += 1;
        }
      })
      .on('end', () => {
        resolve({
          chapterId,
          chapterNumber,
          group: getChapterGroup(chapterNumber),
          type1Count,
          type2Count,
          chapterMaxScore: type1Count + type2Count,
        });
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('Uploading pre-calculated score metadata...');

  const groupTotals = Object.keys(chapterGroups).reduce((acc, groupName) => {
    acc[groupName] = {
      exercise1Max: 0,
      exercise2Max: 0,
      chapterMaxScore: 0,
      chapterCount: 0,
    };
    return acc;
  }, {});

  let totalExercise1Max = 0;
  let totalExercise2Max = 0;
  let totalChapterMaxScore = 0;
  let totalChapters = 0;

  for (let chapterNumber = 1; chapterNumber <= 38; chapterNumber += 1) {
    const counts = await readChapterCounts(chapterNumber);
    if (!counts) {
      console.log(`Skipping ch${chapterNumber}: CSV not found.`);
      continue;
    }

    await db.collection('chapters').doc(counts.chapterId).set(
      {
        chapterNumber: counts.chapterNumber,
        group: counts.group,
        type1Count: counts.type1Count,
        type2Count: counts.type2Count,
        exercise1Max: counts.type1Count,
        exercise2Max: counts.type2Count,
        chapterMaxScore: counts.chapterMaxScore,
      },
      { merge: true }
    );

    totalExercise1Max += counts.type1Count;
    totalExercise2Max += counts.type2Count;
    totalChapterMaxScore += counts.chapterMaxScore;
    totalChapters += 1;

    if (groupTotals[counts.group]) {
      groupTotals[counts.group].exercise1Max += counts.type1Count;
      groupTotals[counts.group].exercise2Max += counts.type2Count;
      groupTotals[counts.group].chapterMaxScore += counts.chapterMaxScore;
      groupTotals[counts.group].chapterCount += 1;
    }

    console.log(`Updated ${counts.chapterId}: ex1=${counts.type1Count}, ex2=${counts.type2Count}, total=${counts.chapterMaxScore}`);
  }

  await db.collection('appMeta').doc('scoreTotals').set(
    {
      totalExercise1Max,
      totalExercise2Max,
      totalChapterMaxScore,
      totalChapters,
      groupTotals,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('Score metadata upload complete.');
}

main().catch((error) => {
  console.error('Metadata upload failed:', error);
  process.exitCode = 1;
});
