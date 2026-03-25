import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../config/firebase';
import { updateProfile } from 'firebase/auth';
import { collection, getDocs, orderBy, query, where, doc, setDoc } from 'firebase/firestore';
import HexagonChart from '../components/HexagonChart';
import { getCachedValue, setCachedValue } from '../utils/cache';
import { getUserBestScoreSummary, updateUserBestScoreSummary } from '../utils/userSummary';
import { loadStaticChapters, loadStaticScoreTotals } from '../utils/staticContent';

const USER_SUMMARY_CACHE_TTL_MS = 60 * 1000;
const CHAPTERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SCORE_TOTALS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function toPositiveCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const baseGroups = {
    "Japanese I": 0,
    "Japanese II": 0,
    "Japanese III": 0,
    "Japanese IV": 0,
    "Japanese V": 0,
    "Japanese VI": 0,
  };
  const [scores, setScores] = useState(baseGroups);
  const [fullMarks, setFullMarks] = useState(baseGroups);
  const [chapterDetails, setChapterDetails] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [nameMessage, setNameMessage] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({ 'Japanese I': true });

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (user) {
      setNameInput(user.displayName || '');
    }
    setLoading(true);

    const fetchScores = async () => {
      try {
        setWarning('');
        const groupOrder = ["Japanese I", "Japanese II", "Japanese III", "Japanese IV", "Japanese V", "Japanese VI"];

        let bestRecords = [];
        if (user) {
          const summaryCacheKey = `summary:${user.uid}:best`;
          const cachedSummary = getCachedValue(summaryCacheKey, USER_SUMMARY_CACHE_TTL_MS);
          const summary = cachedSummary || await (async () => {
            const data = await getUserBestScoreSummary(user.uid);
            setCachedValue(summaryCacheKey, data);
            return data;
          })();

          bestRecords = Object.values(summary || {});

          if (bestRecords.length === 0) {
            const recordsQuery = query(collection(db, 'exerciseRecords'), where('userId', '==', user.uid));
            const recordsSnapshot = await getDocs(recordsQuery);
            const historicalRecords = recordsSnapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));

            if (historicalRecords.length > 0) {
              const historicalBestByChapterExercise = {};
              historicalRecords.forEach((record) => {
                const key = `${record.chapterId}-${record.exerciseType}`;
                if (!historicalBestByChapterExercise[key] || record.score > historicalBestByChapterExercise[key].score) {
                  historicalBestByChapterExercise[key] = record;
                }
              });

              bestRecords = Object.values(historicalBestByChapterExercise);
              await updateUserBestScoreSummary(user.uid, historicalRecords);
              const refreshedSummary = await getUserBestScoreSummary(user.uid);
              setCachedValue(summaryCacheKey, refreshedSummary);
            }
          }
        } else {
          const localRecords = JSON.parse(localStorage.getItem('exerciseRecords') || '[]');
          const bestByChapterExercise = {};

          localRecords.forEach((record) => {
            const key = `${record.chapterId}-${record.exerciseType}`;
            if (!bestByChapterExercise[key] || record.score > bestByChapterExercise[key].score) {
              bestByChapterExercise[key] = record;
            }
          });

          bestRecords = Object.values(bestByChapterExercise);
        }

        const chapterMeta = {};
        let chapters = [];
        const fullByChapterType = {};
        let precomputedGroupTotals = null;

        const fullByChapterTypeFromRecords = {};
        bestRecords.forEach((record) => {
          const chapterId = record.chapterId;
          const exerciseType = record.exerciseType;
          if (!fullByChapterTypeFromRecords[chapterId]) {
            fullByChapterTypeFromRecords[chapterId] = { 1: 0, 2: 0 };
          }
          if (exerciseType === 1 || exerciseType === 2) {
            fullByChapterTypeFromRecords[chapterId][exerciseType] = Math.max(
              fullByChapterTypeFromRecords[chapterId][exerciseType],
              record.totalQuestions || 0
            );
          }
        });

        try {
          const scoreTotalsCacheKey = 'static:scoreTotals:v2';
          const cachedScoreTotals = getCachedValue(scoreTotalsCacheKey, SCORE_TOTALS_CACHE_TTL_MS);
          const scoreTotals = cachedScoreTotals || await (async () => {
            const data = await loadStaticScoreTotals();
            if (data) {
              setCachedValue(scoreTotalsCacheKey, data);
            }
            return data;
          })();

          precomputedGroupTotals = scoreTotals?.groupTotals || null;

          const chapterTotalsMap = scoreTotals?.chapterTotals || {};
          if (Object.keys(chapterTotalsMap).length > 0) {
            chapters = Object.values(chapterTotalsMap)
              .map((item) => ({
                id: item.chapterId,
                chapterNumber: item.chapterNumber,
                name: `Chapter ${item.chapterNumber}`,
                group: item.group,
                exercise1Max: item.exercise1Max,
                exercise2Max: item.exercise2Max,
              }))
              .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
          } else {
            const chapterCacheKey = 'static:chapters:v2';
            const cachedChapters = getCachedValue(chapterCacheKey, CHAPTERS_CACHE_TTL_MS);

            if (cachedChapters) {
              chapters = cachedChapters;
            } else {
              chapters = await loadStaticChapters();
              setCachedValue(chapterCacheKey, chapters);
            }
          }

          chapters.forEach((chapter) => {
            chapterMeta[chapter.id] = chapter;
          }, {});

          chapters.forEach((chapter) => {
            const type1FromMeta = toPositiveCount(chapter.type1Count)
              || toPositiveCount(chapter.exercise1Max)
              || toPositiveCount(chapter.exercise1Total);
            const type2FromMeta = toPositiveCount(chapter.type2Count)
              || toPositiveCount(chapter.exercise2Max)
              || toPositiveCount(chapter.exercise2Total);
            const fallback = fullByChapterTypeFromRecords[chapter.id] || { 1: 0, 2: 0 };
            fullByChapterType[chapter.id] = {
              1: type1FromMeta || fallback[1],
              2: type2FromMeta || fallback[2],
            };
          });

          const hasMissingMetaCounts = chapters.some((chapter) => {
            const full = fullByChapterType[chapter.id] || { 1: 0, 2: 0 };
            return full[1] === 0 && full[2] === 0;
          });

          if (hasMissingMetaCounts) {
            setWarning('Some full-mark totals are estimated from your own records. Run scripts/uploadScoreMetadata.js to upload pre-calculated chapter and global max scores from CSV.');
          }
        } catch (chapterError) {
          console.error('Warning: chapter metadata could not be loaded.', chapterError);
          setWarning('Some profile totals are estimated from your records because full chapter data is unavailable.');
          Object.assign(fullByChapterType, fullByChapterTypeFromRecords);
        }

        const bestByChapterExercise = {};
        bestRecords.forEach((record) => {
          const key = `${record.chapterId}-${record.exerciseType}`;
          if (!bestByChapterExercise[key] || record.score > bestByChapterExercise[key].score) {
            bestByChapterExercise[key] = record;
          }
        });

        const scoreByGroup = groupOrder.reduce((acc, group) => ({ ...acc, [group]: 0 }), {});
        const fullByGroup = precomputedGroupTotals
          ? groupOrder.reduce(
            (acc, group) => ({
              ...acc,
              [group]: toPositiveCount(precomputedGroupTotals[group]?.chapterMaxScore),
            }),
            {}
          )
          : groupOrder.reduce((acc, group) => ({ ...acc, [group]: 0 }), {});

        if (chapters.length > 0 && !precomputedGroupTotals) {
          chapters.forEach((chapter) => {
            const chapterFull = fullByChapterType[chapter.id] || fullByChapterTypeFromRecords[chapter.id] || { 1: 0, 2: 0 };
            fullByGroup[chapter.group] += chapterFull[1] + chapterFull[2];
          });
        }

        Object.values(bestByChapterExercise).forEach((record) => {
          const group = chapterMeta[record.chapterId]?.group || record.chapterGroup || 'Japanese I';
          if (scoreByGroup.hasOwnProperty(group)) {
            scoreByGroup[group] += record.score;
          }
          if (!chapters.length && fullByGroup.hasOwnProperty(group)) {
            fullByGroup[group] += record.totalQuestions || 0;
          }
        });

        let details = [];
        if (chapters.length > 0) {
          details = chapters.map((chapter) => {
            const type1Best = bestByChapterExercise[`${chapter.id}-1`];
            const type2Best = bestByChapterExercise[`${chapter.id}-2`];
            const full = fullByChapterType[chapter.id] || fullByChapterTypeFromRecords[chapter.id] || { 1: 0, 2: 0 };

            return {
              id: chapter.id,
              chapterNumber: chapter.chapterNumber,
              name: chapter.name,
              group: chapter.group,
              type1Score: type1Best ? type1Best.score : null,
              type2Score: type2Best ? type2Best.score : null,
              type1Full: full[1],
              type2Full: full[2],
            };
          });
        } else {
          const detailsFromRecords = {};
          bestRecords.forEach((record) => {
            const key = record.chapterId;
            if (!detailsFromRecords[key]) {
              detailsFromRecords[key] = {
                id: record.chapterId,
                chapterNumber: 999,
                name: record.chapterId,
                group: record.chapterGroup || 'Japanese I',
                type1Score: null,
                type2Score: null,
                type1Full: 0,
                type2Full: 0,
              };
            }

            if (record.exerciseType === 1) {
              detailsFromRecords[key].type1Score = Math.max(detailsFromRecords[key].type1Score || 0, record.score);
              detailsFromRecords[key].type1Full = Math.max(detailsFromRecords[key].type1Full, record.totalQuestions || 0);
            }
            if (record.exerciseType === 2) {
              detailsFromRecords[key].type2Score = Math.max(detailsFromRecords[key].type2Score || 0, record.score);
              detailsFromRecords[key].type2Full = Math.max(detailsFromRecords[key].type2Full, record.totalQuestions || 0);
            }
          });
          details = Object.values(detailsFromRecords);
        }

        const overallTotal = Object.values(scoreByGroup).reduce((sum, current) => sum + current, 0);

        setScores(scoreByGroup);
        setFullMarks(fullByGroup);
        setChapterDetails(details);
        setTotalScore(overallTotal);
      } catch (fetchError) {
        console.error('Error fetching profile data:', fetchError);
        setError('Cannot load profile data right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [user, authLoading]);

  const handleSaveName = async () => {
    setNameMessage('');
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setNameMessage('Name cannot be empty.');
      return;
    }

    setSavingName(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmedName });
      }
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), { displayName: trimmedName }, { merge: true });
      }
      setNameMessage('Name updated successfully.');
    } catch (saveError) {
      console.error('Error updating name:', saveError);
      setNameMessage('Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  const groupOrder = ["Japanese I", "Japanese II", "Japanese III", "Japanese IV", "Japanese V", "Japanese VI"];
  const groupedDetails = chapterDetails.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {});
  const totalFullScore = Object.values(fullMarks).reduce((sum, value) => sum + value, 0);
  
  return (
    <div>
      <h1>{user ? `${user.displayName || user.email}'s Profile` : "Guest Profile"}</h1>

      {user ? (
        <>
          <div className="profile-name-row">
            <div className="name-input-wrap">
              <label htmlFor="profileDisplayName">Display Name</label>
              <input
                id="profileDisplayName"
                type="text"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="Your name"
              />
            </div>
            <button type="button" onClick={handleSaveName} disabled={savingName}>
              {savingName ? 'Saving...' : 'Save Name'}
            </button>
          </div>
          {nameMessage && <p>{nameMessage}</p>}
        </>
      ) : (
        <p>Showing profile from local records on this browser.</p>
      )}

      <h2>Total Score Across All Chapters: {totalScore}/{totalFullScore}</h2>
      <p>Record updates may take up to 1 minute to appear.</p>
      
      <div className="profile-chart-wrap">
        <h3>Progress by Japanese Group</h3>
        <div className="profile-chart-box">
          <HexagonChart scoreData={scores} fullMarkData={fullMarks} />
        </div>
        {loading && <p>Loading profile data...</p>}
        {warning && !loading && <p>{warning}</p>}
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Exercise Details by Chapter</h3>
      {groupOrder.map((groupName) => (
        groupedDetails[groupName] ? (
          <div key={groupName} className="profile-folder-group">
            <button
              type="button"
              className="group-toggle"
              onClick={() => toggleGroup(groupName)}
            >
              <span>{groupName}</span>
              <span className="group-toggle-icon" aria-hidden="true">
                {expandedGroups[groupName] ? '▴' : '▾'}
              </span>
            </button>

            {expandedGroups[groupName] && (
              <div className="profile-folder-content">
                <table>
                  <thead>
                    <tr>
                      <th>Chapter</th>
                      <th>Exercise 1</th>
                      <th>Exercise 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedDetails[groupName].map((detail) => (
                      <tr key={detail.id}>
                        <td>{detail.name}</td>
                        <td>{detail.type1Score ?? <span className="placeholder-mark">--</span>} / {detail.type1Full}</td>
                        <td>{detail.type2Score ?? <span className="placeholder-mark">--</span>} / {detail.type2Full}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null
      ))}
    </div>
  );
}