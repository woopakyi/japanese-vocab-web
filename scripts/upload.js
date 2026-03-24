const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// --- CONFIGURATION ---
// 1. Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Define Chapter Groups
const chapterGroups = {
  "Japanese I": { start: 1, end: 6 },
  "Japanese II": { start: 7, end: 12 },
  "Japanese III": { start: 13, end: 19 },
  "Japanese IV": { start: 20, end: 25 },
  "Japanese V": { start: 26, end: 32 },
  "Japanese VI": { start: 33, end: 38 },
};

// --- SCRIPT LOGIC ---

// Function to find the group for a given chapter number
function getChapterGroup(chapterNumber) {
  for (const groupName in chapterGroups) {
    const group = chapterGroups[groupName];
    if (chapterNumber >= group.start && chapterNumber <= group.end) {
      return groupName;
    }
  }
  return "Unknown Group";
}

async function uploadChapterData(chapterNumber) {
  const chapterId = `ch${chapterNumber}`;
  const csvFilePath = path.join(__dirname, 'data', `${chapterId}.csv`);

  if (!fs.existsSync(csvFilePath)) {
    console.log(`Skipping ${chapterId}: CSV file not found.`);
    return;
  }

  console.log(`Processing ${chapterId}...`);

  // 1. Create/Update the chapter document
  const chapterRef = db.collection('chapters').doc(chapterId);
  await chapterRef.set({
    name: `Chapter ${chapterNumber}`,
    chapterNumber: chapterNumber,
    group: getChapterGroup(chapterNumber),
  });
  console.log(`  - Upserted document in 'chapters' collection for ${chapterId}.`);

  // Clear existing vocabulary docs so re-runs replace data instead of appending duplicates.
  const existingVocabSnap = await chapterRef.collection('vocabularies').get();
  if (!existingVocabSnap.empty) {
    const deleteBatch = db.batch();
    existingVocabSnap.forEach((docSnap) => deleteBatch.delete(docSnap.ref));
    await deleteBatch.commit();
    console.log(`  - Cleared ${existingVocabSnap.size} existing vocabulary docs for ${chapterId}.`);
  }

  // 2. Process and upload vocabularies
  return new Promise((resolve, reject) => {
    const vocabularies = [];
    let order = 0;
    fs.createReadStream(csvFilePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            header ? header.replace(/^\uFEFF/, '').trim().toLowerCase() : header,
        })
      )
      .on('data', (row) => {
        // Use word as-is from CSV
        let word = (row.word && row.word.trim()) ? row.word.trim() : '';

        // Determine vocabulary type
        let type = 0; // Default: Type 0 (Hiragana only)
        if (row.kanji && row.kanji.trim() !== '') {
          type = 1; // Type 1 (Kanji)
        } else if (row.katakana === '1') {
          type = 2; // Type 2 (Katakana)
        }

        vocabularies.push({
          word: word,
          kanji: (row.kanji && row.kanji.trim()) ? row.kanji.trim() : '',
          meaning: (row.meaning && row.meaning.trim()) ? row.meaning.trim() : '',
          type: type,
          originalOrder: order++,
        });
      })
      .on('end', async () => {
        try {
          // Use a batch write for efficiency
          const batch = db.batch();
          const vocabCollectionRef = chapterRef.collection('vocabularies');

          vocabularies.forEach(vocab => {
            const docRef = vocabCollectionRef.doc(String(vocab.originalOrder));
            batch.set(docRef, vocab);
          });

          await batch.commit();
          console.log(`  - Successfully uploaded ${vocabularies.length} vocabulary words for ${chapterId}.`);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// --- EXECUTION ---
async function main() {
  console.log("Starting Firestore data upload...");
  // Loop through all 38 chapters
  for (let i = 1; i <= 38; i++) {
    await uploadChapterData(i);
  }
  console.log("Data upload process finished. It may take a few moments for all asynchronous operations to complete.");
}

main().catch(console.error);