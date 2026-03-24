import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading authentication...</div>;
  }

  if (!user) {
    // Redirect them to the home page, but save the current location they were
    // trying to go to. This allows us to send them back after they log in.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}