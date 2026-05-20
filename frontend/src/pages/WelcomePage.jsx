import { useState } from 'react';
import { apiRequest, API_ENDPOINTS } from '../config/api.js';

export default function WelcomePage({ onLoginSuccess, onNavigateToRegister }) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });
      onLoginSuccess(data.username);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const FEATURES = [
    { icon: '🎯', title: 'Set Your Goals', desc: 'Define your path to success' },
    { icon: '📋', title: 'Daily Random Quests', desc: 'Complete challenges to level up' },
    { icon: '🔥', title: 'Track Progress', desc: 'Maintain momentum and stay motivated' },
    { icon: '📊', title: 'View Stats', desc: 'Watch your skills grow over time' },
  ];

  if (!isLoginMode) {
    return (
      <div className="paper-bg min-h-screen flex items-center justify-center p-4">
        <div className="rpg-window max-w-md w-full page-enter">
          <div className="rpg-header text-base">Level Up — Growth Journal</div>
          <div className="px-6 py-6">
            <p className="text-ink-soft text-sm mb-6 text-center italic">
              Transform your daily life into an epic adventure
            </p>

            <div className="space-y-4 mb-8">
              {FEATURES.map(f => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{f.icon}</span>
                  <div>
                    <h3 className="font-semibold text-ink text-sm">{f.title}</h3>
                    <p className="text-xs text-ink-mute">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="paper-divider mb-5"><span>begin your journey</span></div>

            <div className="space-y-3">
              <button
                onClick={onNavigateToRegister}
                className="rpg-btn-primary w-full"
              >
                Create Account
              </button>
              <button
                onClick={() => setIsLoginMode(true)}
                className="rpg-btn-secondary w-full"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  // Generate a per-browser guest username so each device has its own data.
                  let guest = localStorage.getItem('levelup_guest_id');
                  if (!guest) {
                    guest = 'guest_' + Math.random().toString(36).slice(2, 8);
                    localStorage.setItem('levelup_guest_id', guest);
                  }
                  onLoginSuccess(guest);
                }}
                className="w-full text-xs text-ink-mute hover:text-ink underline transition-colors py-1"
              >
                Continue as guest (no account needed)
              </button>
            </div>

            <p className="text-xs text-ink-mute text-center mt-6">
              Join other adventurers on their path to success
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-bg min-h-screen flex items-center justify-center p-4">
      <div className="rpg-window max-w-sm w-full page-enter">
        <div className="rpg-header">Welcome Back</div>
        <div className="px-6 py-6">
          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm text-ink border-2 rounded-sm"
              style={{ background: 'var(--paper-deep)', borderColor: 'var(--accent-rust)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="rpg-input"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="rpg-input"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rpg-btn-primary w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="paper-divider mt-5 mb-4"><span>or</span></div>

          <div className="flex flex-col gap-2 text-center text-sm">
            <button
              onClick={() => setIsLoginMode(false)}
              className="text-ink-mute hover:text-ink transition-colors"
            >
              ← Back
            </button>
            <span className="text-ink-mute text-xs">
              No account?{' '}
              <button
                onClick={onNavigateToRegister}
                className="text-rose underline hover:text-ink transition-colors"
              >
                Register here
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
