import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../config/firebase';
import { getCachedValue, setCachedValue } from '../utils/cache';

const USER_RECORDS_CACHE_TTL_MS = 5 * 60 * 1000;

function formatCompletedAt(value) {
  if (!value) return '--';

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleString();
  }

  return '--';
}

function completedAtToMs(value) {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  return 0;
}

function chapterLabel(chapterId) {
  if (!chapterId) return '--';
  return chapterId.replace(/^ch/i, '');
}

export default function Records() {
  const RECORDS_PER_PAGE = 10;
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const chapterFilter = searchParams.get('chapterId') || '';
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRecordKey, setExpandedRecordKey] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (authLoading) return;

    const fetchRecords = async () => {
      setLoading(true);
      setError('');
      try {
        if (user) {
          const userRecordsCacheKey = `records:${user.uid}:all`;
          const cachedRecords = getCachedValue(userRecordsCacheKey, USER_RECORDS_CACHE_TTL_MS);

          if (cachedRecords) {
            setRecords(cachedRecords);
          } else {
            const recordsQuery = query(
              collection(db, 'exerciseRecords'),
              where('userId', '==', user.uid)
            );
            const snapshot = await getDocs(recordsQuery);
            const data = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
            setCachedValue(userRecordsCacheKey, data);
            setRecords(data);
          }
        } else {
          const local = JSON.parse(localStorage.getItem('exerciseRecords') || '[]');
          setRecords(Array.isArray(local) ? local : []);
        }
      } catch (fetchError) {
        console.error('Error loading records:', fetchError);
        setError('Cannot load exercise records right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [user, authLoading]);

  const sortedRecords = useMemo(() => {
    const filtered = chapterFilter
      ? records.filter((record) => record.chapterId === chapterFilter)
      : records;
    return [...filtered].sort((a, b) => completedAtToMs(b.completedAt) - completedAtToMs(a.completedAt));
  }, [records, chapterFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedRecordKey('');
  }, [chapterFilter, records]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / RECORDS_PER_PAGE));
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const pageRecords = sortedRecords.slice(startIndex, startIndex + RECORDS_PER_PAGE);

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
    setExpandedRecordKey('');
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    setExpandedRecordKey('');
  };

  if (loading || authLoading) {
    return <div>Loading exercise records...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  return (
    <div>
      <h1>Past Exercise Records</h1>
      <p>{user ? 'Showing records saved to your account.' : 'Showing records saved on this browser.'}</p>
      {chapterFilter && <p>Filtered by Chapter {chapterLabel(chapterFilter)}.</p>}

      {sortedRecords.length === 0 ? (
        <p>No exercise records yet.</p>
      ) : (
        <div>
          <table>
            <thead>
              <tr>
                <th>Completed At</th>
                <th>Chapter</th>
                <th>Exercise Type</th>
                <th>Score</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords.map((record, index) => {
                const absoluteIndex = startIndex + index;
                const rowKey = record.id || `${record.chapterId}-${record.exerciseType}-${absoluteIndex}`;
                const isOpen = expandedRecordKey === rowKey;
                return (
                  <React.Fragment key={rowKey}>
                    <tr>
                      <td>{formatCompletedAt(record.completedAt)}</td>
                      <td>{chapterLabel(record.chapterId)}</td>
                      <td>{record.exerciseType || '--'}</td>
                      <td>{record.score ?? '--'} / {record.totalQuestions ?? '--'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpandedRecordKey(isOpen ? '' : rowKey)}
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={5}>
                          {Array.isArray(record.results) && record.results.length > 0 ? (
                            <table>
                              <thead>
                                <tr>
                                  <th>Question</th>
                                  <th>Your Answer</th>
                                  <th>Correct Answer</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {record.results.map((item, resultIndex) => (
                                  <tr key={`${rowKey}-result-${resultIndex}`}>
                                    <td>{item.question}</td>
                                    <td>
                                      <span className={item.isCorrect ? 'record-status-correct' : 'record-status-wrong'}>
                                        {item.userAnswer || '--'}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={item.isCorrect ? 'record-status-correct' : 'record-status-wrong'}>
                                        {item.correctAnswer || '--'}
                                      </span>
                                    </td>
                                    <td>
                                      <strong className={item.isCorrect ? 'record-status-correct' : 'record-status-wrong'}>
                                        {item.isCorrect ? 'Correct' : 'Incorrect'}
                                      </strong>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p>No detailed answer data found for this attempt.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="pagination-controls">
            <button type="button" onClick={goToPreviousPage} disabled={currentPage === 1}>
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button type="button" onClick={goToNextPage} disabled={currentPage === totalPages}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
