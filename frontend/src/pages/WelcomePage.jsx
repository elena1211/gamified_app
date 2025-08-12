import { useState } from 'react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { COLORS, EMOJIS, ANIMATION_CLASSES, LAYOUT_CLASSES } from '../config/constants.js';

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
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await apiRequest(API_ENDPOINTS.login, {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      onLoginSuccess(data.username);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoginMode) {
    return (
      <div className={LAYOUT_CLASSES.container}>
        <div className={`${LAYOUT_CLASSES.cardLarge} p-12 max-w-lg w-full text-center`}>
          {/* Logo and Title */}
          <div className="mb-8">
            <div className="text-7xl mb-4">{EMOJIS.logo}</div>
            <h1 className={`text-4xl font-bold ${COLORS.text.primary} mb-2`}>Level Up</h1>
            <p className={`text-xl ${COLORS.text.secondary}`}>Transform your life into an epic adventure!</p>
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
                <h3 className="font-semibold text-gray-800">Daily Random Tasks</h3>
                <p className="text-sm text-gray-600">Complete daily challenges to level up</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">🔥</span>
              <div>
                <h3 className="font-semibold text-gray-800">Track Progress</h3>
                <p className="text-sm text-gray-600">Maintain momentum and stay motivated</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-semibold text-gray-800">View Stats</h3>
                <p className="text-sm text-gray-600">Watch your skills grow over time</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={onNavigateToRegister}
              className={`w-full ${COLORS.button.primary} text-white py-4 rounded-xl text-lg font-semibold shadow-lg ${ANIMATION_CLASSES.button} hover:shadow-xl`}
            >
              {EMOJIS.rocket} Get Started
            </button>

            <button
              onClick={() => setIsLoginMode(true)}
              className={`w-full ${COLORS.button.secondary} ${COLORS.text.primary} py-4 rounded-xl text-lg font-medium ${ANIMATION_CLASSES.button}`}
            >
              {EMOJIS.login} I already have an account
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
    <div className={LAYOUT_CLASSES.container}>
      <div className={`${LAYOUT_CLASSES.card} p-8 max-w-md w-full`}>
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{EMOJIS.login}</div>
          <h1 className={`text-3xl font-bold ${COLORS.text.primary} mb-2`}>Welcome!</h1>
          <p className={COLORS.text.secondary}>Continue your epic journey</p>
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
              className={LAYOUT_CLASSES.input}
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
              className={LAYOUT_CLASSES.input}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${COLORS.button.primary} text-white py-3 rounded-lg font-semibold ${ANIMATION_CLASSES.button} ${ANIMATION_CLASSES.buttonDisabled}`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className={`w-4 h-4 border-2 border-white border-t-transparent rounded-full ${ANIMATION_CLASSES.spinner}`}></div>
                Loading...
              </div>
            ) : (
              `${EMOJIS.logo} Sign In`
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLoginMode(false)}
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors cursor-pointer"
          >
            ← Back
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-pink-500 hover:text-pink-600 font-medium cursor-pointer underline hover:underline"
            >
              Click here to register
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
