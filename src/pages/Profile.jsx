import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../config/firebase';
import { updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, doc, setDoc } from 'firebase/firestore';
import HexagonChart from '../components/HexagonChart';

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
        const groupOrder = ["Japanese I", "Japanese II", "Japanese III", "Japanese IV", "Japanese V", "Japanese VI"];

        let userRecords = [];
        if (user) {
          const recordsQuery = query(collection(db, 'exerciseRecords'), where('userId', '==', user.uid));
          const recordsSnapshot = await getDocs(recordsQuery);
          userRecords = recordsSnapshot.docs.map(docItem => docItem.data());
        } else {
          userRecords = JSON.parse(localStorage.getItem('exerciseRecords') || '[]');
        }

        const chapterMeta = {};
        let chapters = [];
        let fullByChapterType = {};

        const fullByChapterTypeFromRecords = {};
        userRecords.forEach((record) => {
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
          const chaptersQuery = query(collection(db, 'chapters'), orderBy('chapterNumber'));
          const chaptersSnapshot = await getDocs(chaptersQuery);
          chapters = chaptersSnapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));

          chapters.forEach((chapter) => {
            chapterMeta[chapter.id] = chapter;
          });

          const vocabCountResults = await Promise.all(
            chapters.map(async (chapter) => {
              const vocabSnapshot = await getDocs(collection(db, 'chapters', chapter.id, 'vocabularies'));
              const vocabList = vocabSnapshot.docs.map(docItem => docItem.data());
              return {
                chapterId: chapter.id,
                type1: vocabList.filter(item => item.type === 1).length,
                type2: vocabList.filter(item => item.type === 2).length,
              };
            })
          );

          fullByChapterType = vocabCountResults.reduce((acc, item) => {
            acc[item.chapterId] = { 1: item.type1, 2: item.type2 };
            return acc;
          }, {});
        } catch (chapterError) {
          console.error('Warning: chapter metadata could not be loaded.', chapterError);
          setWarning('Some profile totals are estimated from your records because full chapter data is unavailable.');
          fullByChapterType = fullByChapterTypeFromRecords;
        }

        const bestByChapterExercise = {};
        userRecords.forEach((record) => {
          const key = `${record.chapterId}-${record.exerciseType}`;
          if (!bestByChapterExercise[key] || record.score > bestByChapterExercise[key].score) {
            bestByChapterExercise[key] = record;
          }
        });

        const scoreByGroup = groupOrder.reduce((acc, group) => ({ ...acc, [group]: 0 }), {});
        const fullByGroup = groupOrder.reduce((acc, group) => ({ ...acc, [group]: 0 }), {});

        if (chapters.length > 0) {
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
          userRecords.forEach((record) => {
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

      <h2>Total Score Across All Chapters: {totalScore}</h2>
      
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