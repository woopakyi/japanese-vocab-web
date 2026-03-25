const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

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

function readChapterCsv(chapterNumber) {
  return new Promise((resolve, reject) => {
    const chapterId = `ch${chapterNumber}`;
    const csvFilePath = path.join(__dirname, 'data', `${chapterId}.csv`);

    if (!fs.existsSync(csvFilePath)) {
      resolve(null);
      return;
    }

    const vocabularies = [];
    let order = 0;
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
        let type = 0;
        if (row.kanji && row.kanji.trim() !== '') {
          type = 1;
          type1Count += 1;
        } else if (row.katakana === '1') {
          type = 2;
          type2Count += 1;
        }

        vocabularies.push({
          id: String(order),
          word: (row.word && row.word.trim()) ? row.word.trim() : '',
          kanji: (row.kanji && row.kanji.trim()) ? row.kanji.trim() : '',
          meaning: (row.meaning && row.meaning.trim()) ? row.meaning.trim() : '',
          type,
          originalOrder: order,
        });

        order += 1;
      })
      .on('end', () => {
        const group = getChapterGroup(chapterNumber);
        resolve({
          chapter: {
            id: chapterId,
            name: `Chapter ${chapterNumber}`,
            chapterNumber,
            group,
            type1Count,
            type2Count,
            exercise1Max: type1Count,
            exercise2Max: type2Count,
            chapterMaxScore: type1Count + type2Count,
            totalVocabularyCount: vocabularies.length,
          },
          vocabularies,
        });
      })
      .on('error', reject);
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function main() {
  const publicDataDir = path.join(__dirname, '..', 'public', 'data');
  const vocabDir = path.join(publicDataDir, 'vocab');

  ensureDir(publicDataDir);
  ensureDir(vocabDir);

  const chapters = [];
  const groupTotals = Object.keys(chapterGroups).reduce((acc, groupName) => {
    acc[groupName] = {
      exercise1Max: 0,
      exercise2Max: 0,
      chapterMaxScore: 0,
      chapterCount: 0,
    };
    return acc;
  }, {});

  const chapterTotals = {};

  let totalExercise1Max = 0;
  let totalExercise2Max = 0;
  let totalChapterMaxScore = 0;

  for (let chapterNumber = 1; chapterNumber <= 38; chapterNumber += 1) {
    const result = await readChapterCsv(chapterNumber);
    if (!result) {
      continue;
    }

    chapters.push(result.chapter);

    const chapterId = result.chapter.id;
    fs.writeFileSync(
      path.join(vocabDir, `${chapterId}.json`),
      JSON.stringify(result.vocabularies, null, 2),
      'utf8'
    );

    totalExercise1Max += result.chapter.exercise1Max;
    totalExercise2Max += result.chapter.exercise2Max;
    totalChapterMaxScore += result.chapter.chapterMaxScore;

    chapterTotals[chapterId] = {
      chapterId,
      chapterNumber: result.chapter.chapterNumber,
      group: result.chapter.group,
      exercise1Max: result.chapter.exercise1Max,
      exercise2Max: result.chapter.exercise2Max,
      chapterMaxScore: result.chapter.chapterMaxScore,
    };

    const group = groupTotals[result.chapter.group];
    if (group) {
      group.exercise1Max += result.chapter.exercise1Max;
      group.exercise2Max += result.chapter.exercise2Max;
      group.chapterMaxScore += result.chapter.chapterMaxScore;
      group.chapterCount += 1;
    }
  }

  chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (totalChapterMaxScore > 0) {
    Object.keys(groupTotals).forEach((groupName) => {
      const group = groupTotals[groupName];
      group.shareOfTotalPct = Number(((group.chapterMaxScore / totalChapterMaxScore) * 100).toFixed(2));
    });

    Object.keys(chapterTotals).forEach((chapterId) => {
      const chapter = chapterTotals[chapterId];
      chapter.shareOfTotalPct = Number(((chapter.chapterMaxScore / totalChapterMaxScore) * 100).toFixed(2));
    });
  }

  fs.writeFileSync(path.join(publicDataDir, 'chapters.json'), JSON.stringify(chapters, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(publicDataDir, 'scoreTotals.json'),
    JSON.stringify(
      {
        totalExercise1Max,
        totalExercise2Max,
        totalChapterMaxScore,
        totalChapters: chapters.length,
        groupTotals,
        chapterTotals,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Generated static content for ${chapters.length} chapters in public/data.`);
}

main().catch((error) => {
  console.error('Static data generation failed:', error);
  process.exitCode = 1;
});
