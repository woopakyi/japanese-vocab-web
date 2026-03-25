import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Chapter from './pages/Chapter';
import Exercise from './pages/Exercise';
import Results from './pages/Results';
import Profile from './pages/Profile';
import Records from './pages/Records';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Public Routes */}
          <Route index element={<Home />} />
          <Route path="chapter/:chapterId" element={<Chapter />} />
          <Route path="exercise/:chapterId/:exerciseType" element={<Exercise />} />
          <Route path="results" element={<Results />} />
          <Route path="records" element={<Records />} />

          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;