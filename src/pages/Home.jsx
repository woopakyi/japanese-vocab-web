import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function Home() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const q = query(collection(db, 'chapters'), orderBy('chapterNumber'));
        const querySnapshot = await getDocs(q);
        const chaptersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
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
        if (error?.code === 'permission-denied') {
          setError('Cannot load chapters: Firestore rules currently block public read access.');
        } else {
          setError('Cannot load chapters right now. Please try again later.');
        }
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
      <h1>Japanese Vocabulary Chapters</h1>
      {Object.keys(chapters).length === 0 && <p>No chapters found.</p>}
      {groupOrder.map(groupName => (
        chapters[groupName] && (
          <div key={groupName} className="group-section">
            <h2>{groupName}</h2>
            <div className="chapter-grid">
              {chapters[groupName].map(chapter => (
                <Link 
                  key={chapter.id} 
                  to={`/chapter/${chapter.id}`}
                  className="chapter-card"
                >
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