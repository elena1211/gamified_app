import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './Homepage';
import RegisterPage from './components/RegisterPage';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const handleRegisterSuccess = (username) => {
    setCurrentUser(username);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/register" 
            element={
              currentUser ? 
                <Navigate to="/home" replace /> : 
                <RegisterPage onRegisterSuccess={handleRegisterSuccess} />
            } 
          />
          <Route 
            path="/home" 
            element={
              currentUser ? 
                <Homepage currentUser={currentUser} /> : 
                <Navigate to="/register" replace />
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to={currentUser ? "/home" : "/register"} replace />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;