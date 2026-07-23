import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Route Guard for authenticated clinicians
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vitora-bg font-bold text-xs text-vitora-text/45 uppercase tracking-widest animate-pulse">
        Initializing Clinician Portal...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication page */}
          <Route path="/login" element={<Login />} />

          {/* Protected Clinician Dashboards & Wizards */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/screening"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="/report/:uuid"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="/history"
            element={<Navigate to="/" replace />}
          />

          {/* Catch-all redirect to index dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
