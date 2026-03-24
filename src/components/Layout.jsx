import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import Auth from './Auth';

export default function Layout() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/'); // Navigate to home on logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="nav-left">
          <Link className="nav-link" to="/">Home</Link>
          {user && <Link className="nav-link" to="/profile">Profile</Link>}
        </div>
        <div className="nav-right">
          {loading ? (
            <span>Loading...</span>
          ) : user ? (
            <>
              <span className="welcome">Welcome, {user.displayName || user.email}</span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)}>Login / Sign Up</button>
          )}
        </div>
      </nav>

      {showAuthModal && <Auth closeModal={() => setShowAuthModal(false)} />}
      
      <main>
        <Outlet />
      </main>
    </div>
  );
}