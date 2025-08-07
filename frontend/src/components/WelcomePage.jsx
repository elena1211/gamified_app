import { useState } from 'react';

const API_ENDPOINTS = {
  login: 'http://127.0.0.1:8002/api/login/'
};

export default function WelcomePage({ onLoginSuccess, onNavigateToRegister }) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(API_ENDPOINTS.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        onLoginSuccess(data.username);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoginMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-12 shadow-xl max-w-lg w-full text-center">
          {/* Logo and Title */}
          <div className="mb-8">
            <div className="text-7xl mb-4">🎮</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Level Up</h1>
            <p className="text-xl text-gray-600">Transform your life into an epic adventure!</p>
          </div>

          {/* Features */}
          <div className="mb-8 space-y-4">
            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">🎯</span>
              <div>
                <h3 className="font-semibold text-gray-800">Set Your Goals</h3>
                <p className="text-sm text-gray-600">Define your path to success</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="font-semibold text-gray-800">Complete Quests</h3>
                <p className="text-sm text-gray-600">Turn tasks into exciting challenges</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">🔥</span>
              <div>
                <h3 className="font-semibold text-gray-800">Build Streaks</h3>
                <p className="text-sm text-gray-600">Maintain momentum and stay motivated</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-semibold text-gray-800">Track Progress</h3>
                <p className="text-sm text-gray-600">Watch your skills grow over time</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={onNavigateToRegister}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-4 rounded-xl text-lg font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              🚀 Start Your Journey
            </button>
            
            <button
              onClick={() => setIsLoginMode(true)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl text-lg font-medium transition-all duration-300 hover:scale-105"
            >
              🔐 I Already Have an Account
            </button>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-500 mt-8">
            Join thousands of adventurers on their path to success
          </p>
        </div>
      </div>
    );
  }

  // Login Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back!</h1>
          <p className="text-gray-600">Continue your epic journey</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing In...
              </div>
            ) : (
              '🎮 Enter Game'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLoginMode(false)}
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            ← Back to Welcome
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-pink-500 hover:text-pink-600 font-medium"
            >
              Start your journey here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
