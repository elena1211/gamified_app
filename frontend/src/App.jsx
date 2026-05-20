import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TaskManagerPage from './pages/TaskManagerPage';
import RegisterPage from './pages/RegisterPage';
import WelcomePage from './pages/WelcomePage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import SystemPage from './pages/SystemPage';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProvider, useAppContext } from './context/AppContext';
import { debugLog } from './utils/logger';

function AppRoutes() {
  const {
    currentUser,
    isLoading,
    handleLoginSuccess,
    handleLogout
  } = useAppContext();

  const navigate = useNavigate();

  debugLog('AppRoutes rendering, currentUser:', currentUser, 'isLoading:', isLoading);

  const handleRegisterSuccess = (username) => {
    handleLoginSuccess(username);
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

  const handleNavigateToSystem = () => {
    navigate('/system');
  };

  const handleLogoutAndNavigate = () => {
    handleLogout();
    navigate('/welcome');
  };

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="paper-bg min-h-screen flex items-center justify-center">
        <p className="font-display text-xl text-ink-soft animate-pulse tracking-wide">
          System initialising…
        </p>
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
              <HomePage
                currentUser={currentUser}
                onLogout={handleLogoutAndNavigate}
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
                onLogout={handleLogoutAndNavigate}
                onNavigateToHome={handleNavigateToHome}
                onNavigateToTaskManager={handleNavigateToTaskManager}
              />
            </ErrorBoundary> :
            <Navigate to="/welcome" replace />
        }
      />
      <Route
        path="/system"
        element={
          currentUser ?
            <ErrorBoundary>
              <SystemPage
                onNavigateToHome={handleNavigateToHome}
                onNavigateToTaskManager={handleNavigateToTaskManager}
                onNavigateToSettings={handleNavigateToSettings}
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
  debugLog('App component is rendering');
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router>
          <div className="App">
            <AppRoutes />
          </div>
        </Router>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
