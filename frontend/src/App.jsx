import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Homepage from './Homepage';
import TaskManagerPage from './TaskManagerPage';
import RegisterPage from './pages/RegisterPage';
import WelcomePage from './pages/WelcomePage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import ErrorBoundary from './components/ErrorBoundary';

function AppRoutes() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize user state from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (username) => {
    setCurrentUser(username);
    localStorage.setItem('currentUser', username);
  };

  const handleRegisterSuccess = (username) => {
    setCurrentUser(username);
    localStorage.setItem('currentUser', username);
  };

  const handleNavigateToRegister = () => {
    navigate('/register');
  };

  const handleNavigateBack = () => {
    navigate('/welcome');
  };

  const handleNavigateToSettings = () => {
    navigate('/settings');
  };

  const handleNavigateToTaskManager = () => {
    navigate('/tasks');
  };

  const handleNavigateToHome = () => {
    navigate('/home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    navigate('/welcome');
  };

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-purple-800 text-xl">🎮 Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/welcome" 
        element={
          currentUser ? 
            <Navigate to="/home" replace /> : 
            <WelcomePage 
              onLoginSuccess={handleLoginSuccess}
              onNavigateToRegister={handleNavigateToRegister}
            />
        } 
      />
      <Route 
        path="/register" 
        element={
          currentUser ? 
            <Navigate to="/home" replace /> : 
            <RegisterPage 
              onRegisterSuccess={handleRegisterSuccess}
              onNavigateBack={handleNavigateBack}
            />
        } 
      />
      <Route 
        path="/home" 
        element={
          currentUser ? 
            <ErrorBoundary>
              <Homepage 
                currentUser={currentUser} 
                onLogout={handleLogout}
                onNavigateToSettings={handleNavigateToSettings}
                onNavigateToTaskManager={handleNavigateToTaskManager}
              />
            </ErrorBoundary> : 
            <Navigate to="/welcome" replace />
        } 
      />
      <Route 
        path="/tasks" 
        element={
          currentUser ? 
            <ErrorBoundary>
              <TaskManagerPage 
                currentUser={currentUser}
                onNavigateToHome={handleNavigateToHome}
                onNavigateToSettings={handleNavigateToSettings}
              />
            </ErrorBoundary> : 
            <Navigate to="/welcome" replace />
        } 
      />
      <Route 
        path="/settings" 
        element={
          currentUser ? 
            <ErrorBoundary>
              <SystemSettingsPage 
                currentUser={currentUser}
                onBack={handleNavigateToHome}
                onLogout={handleLogout}
              />
            </ErrorBoundary> : 
            <Navigate to="/welcome" replace />
        } 
      />
      <Route 
        path="/" 
        element={<Navigate to={currentUser ? "/home" : "/welcome"} replace />} 
      />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;