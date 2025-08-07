import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Homepage from './Homepage';
import RegisterPage from './components/RegisterPage';
import WelcomePage from './components/WelcomePage';
import SystemSettingsPage from './pages/SystemSettingsPage';

function AppRoutes() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  const handleLoginSuccess = (username) => {
    setCurrentUser(username);
  };

  const handleRegisterSuccess = (username) => {
    setCurrentUser(username);
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

  const handleNavigateToHome = () => {
    navigate('/home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    navigate('/welcome');
  };

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
            <Homepage 
              currentUser={currentUser} 
              onLogout={handleLogout}
              onNavigateToSettings={handleNavigateToSettings}
            /> : 
            <Navigate to="/welcome" replace />
        } 
      />
      <Route 
        path="/settings" 
        element={
          currentUser ? 
            <SystemSettingsPage 
              currentUser={currentUser}
              onBack={handleNavigateToHome}
              onLogout={handleLogout}
            /> : 
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
    <Router>
      <div className="App">
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;