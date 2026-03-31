import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import App from './App'; // Existing main app component

/**
 * Main Router Component (Phase 5.4 - Session Management)
 * 
 * Implements:
 * - AuthProvider for global auth state management
 * - Protected routes that require authentication
 * - Login/Signup flow
 * - Session persistence across browser refresh
 * 
 * Usage: Replace main App render with this RouterApp component
 * 
 * @example
 * // In index.tsx (formerly App render)
 * root.render(<RouterApp />)
 */
export const RouterApp: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default RouterApp;
