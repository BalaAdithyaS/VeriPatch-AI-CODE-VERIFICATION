import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Register from './pages/Register';
import GithubConnect from './pages/GithubConnect';
import RepositoryList from './pages/RepositoryList';
import Workspace from './pages/Workspace';
import Dashboard from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full min-h-96 gap-2"
      style={{ color: 'var(--muted)' }}
    >
      <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      <p className="text-[12px]">This section is coming soon.</p>
    </div>
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes – no shell */}
          <Route path="/login"    element={<Login />}    />
          <Route path="/register" element={<Register />} />

          {/* Protected routes – wrapped in AppShell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell><Dashboard /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/github/connect"
            element={
              <ProtectedRoute>
                <AppShell><GithubConnect /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/github/repositories"
            element={
              <ProtectedRoute>
                <AppShell><RepositoryList /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:id"
            element={
              <ProtectedRoute>
                <AppShell><Workspace /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyses"
            element={
              <ProtectedRoute>
                <AppShell><PlaceholderPage title="Analyses" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/findings"
            element={
              <ProtectedRoute>
                <AppShell><PlaceholderPage title="Findings" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pull-requests"
            element={
              <ProtectedRoute>
                <AppShell><PlaceholderPage title="Pull Requests" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <AppShell><PlaceholderPage title="History" /></AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell><PlaceholderPage title="Settings" /></AppShell>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
