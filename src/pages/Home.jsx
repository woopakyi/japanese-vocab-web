import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedValue, setCachedValue } from '../utils/cache';
import { loadStaticChapters } from '../utils/staticContent';

const CHAPTERS_CACHE_KEY = 'chapters:meta';
const CHAPTERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export default function Home() {
  const [chapters, setChapters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const cachedChapters = getCachedValue(CHAPTERS_CACHE_KEY, CHAPTERS_CACHE_TTL_MS);
        const chaptersData = cachedChapters || await (async () => {
          const data = await loadStaticChapters();
          setCachedValue(CHAPTERS_CACHE_KEY, data);
          return data;
        })();
        
        // Group chapters
        const grouped = chaptersData.reduce((acc, chapter) => {
          const group = chapter.group;
          if (!acc[group]) {
            acc[group] = [];
          }
          acc[group].push(chapter);
          return acc;
        }, {});

        setChapters(grouped);
      } catch (error) {
        console.error("Error fetching chapters:", error);
        setError('Cannot load chapter content right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, []);

  if (loading) {
    return <div>Loading chapters...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }
  
  // Define the order of groups
  const groupOrder = ["Japanese I", "Japanese II", "Japanese III", "Japanese IV", "Japanese V", "Japanese VI"];

  return (
    <div>
      <h1>Japanese Vocabulary</h1>
      <p className="home-intro">
        This website is designed for students registered in the JPSE course. However, students who are not
        registered are also welcome to use it.
      </p>
      {Object.keys(chapters).length === 0 && <p>No chapters found.</p>}
      {groupOrder.map(groupName => (
        chapters[groupName] && (
          <div key={groupName} className="group-section">
            <h2>{groupName}</h2>
            <div className="chapter-grid">
              {chapters[groupName].map(chapter => (
                <Link key={chapter.id} to={`/chapter/${chapter.id}`} className="chapter-card">
                  {chapter.name}
                </Link>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}