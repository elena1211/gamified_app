import { useState, useRef, useEffect } from 'react';
import { User, Bell } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import BottomNav from '../components/BottomNav.jsx';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';

export default function SystemSettingsPage({ currentUser, onLogout, onUpgradeSuccess, onNavigateToHome, onNavigateToTaskManager }) {
  const [activeSection, setActiveSection] = useState('account');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [upgradeData, setUpgradeData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [upgradeError, setUpgradeError] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState(false);
  const upgradeSuccessRef = useRef(null);
  const [preferences, setPreferences] = useState({
    notifications: localStorage.getItem('notifications') !== 'false',
    soundEffects: localStorage.getItem('soundEffects') !== 'false',
    dailyReminder: localStorage.getItem('dailyReminder') !== 'false',
  });

  const sections = [
    { id: 'account', title: 'Account', Icon: User },
    { id: 'preferences', title: 'Preferences', Icon: Bell },
  ];

  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(key, value);
  };

  const isGuest = typeof currentUser === 'string' && currentUser.startsWith('guest_');

  // Move focus to the success confirmation once the guest banner/form
  // unmounts — otherwise a keyboard/AT user's focus is silently dropped to
  // <body> with no indication the upgrade worked.
  useEffect(() => {
    if (justUpgraded && !isGuest) upgradeSuccessRef.current?.focus();
  }, [justUpgraded, isGuest]);

  const handleUpgradeInputChange = (e) => {
    const { name, value } = e.target;
    setUpgradeData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpgradeSubmit = async (e) => {
    e.preventDefault();
    if (!upgradeData.username.trim() || !upgradeData.password) {
      setUpgradeError('Username and password are required');
      return;
    }
    if (upgradeData.password.length < 6) {
      setUpgradeError('Password must be at least 6 characters');
      return;
    }
    if (upgradeData.password !== upgradeData.confirmPassword) {
      setUpgradeError('Passwords do not match');
      return;
    }
    setUpgrading(true);
    setUpgradeError('');
    try {
      const { data } = await apiRequest(API_ENDPOINTS.upgradeGuest, {
        method: 'POST',
        body: JSON.stringify({
          username: upgradeData.username.trim(),
          email: upgradeData.email,
          password: upgradeData.password,
        }),
      });
      // This browser's cached guest id now belongs to a password-protected
      // account — drop it so a future "Continue as guest" click mints a
      // fresh guest identity instead of colliding with it.
      localStorage.removeItem('levelup_guest_id');
      setJustUpgraded(true);
      onUpgradeSuccess?.(data.username, data.token);
    } catch (err) {
      setUpgradeError(err.message || 'Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  };

  const renderAccountSection = () => (
    <div className="space-y-3">
      <h3 className="font-display text-base text-ink mb-3">Account Information</h3>
      <div className="rpg-window-light px-4 py-3 text-sm space-y-2">
        {[
          ['Username', currentUser],
          ['Account Status', isGuest
            ? <span key="s" className="text-rust">Guest (data on this device only)</span>
            : <span key="s" className="text-sage">Active</span>],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-ink-mute">{label}</span>
            <span className="text-ink font-medium">{value}</span>
          </div>
        ))}
      </div>

      {justUpgraded && !isGuest && (
        <div
          ref={upgradeSuccessRef}
          tabIndex={-1}
          role="status"
          className="rpg-window px-4 py-3 mt-3"
          style={{ borderColor: 'var(--accent-sage)', background: '#F0F7EC' }}
        >
          <p className="text-sm text-sage font-medium">
            ✓ Account saved — your level, quests and streak carried over.
          </p>
        </div>
      )}

      {isGuest && (
        <div
          className="rpg-window px-4 py-3 mt-3"
          style={{ borderColor: 'var(--accent-gold)', background: '#FFF9E6' }}
        >
          <p className="text-sm text-ink mb-2">
            You are using LevelUp as a guest. Your progress is stored only on this device
            and may be lost if you clear browser data.
          </p>

          {!showUpgradeForm ? (
            <button
              onClick={() => setShowUpgradeForm(true)}
              className="rpg-btn-primary text-xs"
            >
              Create a Real Account
            </button>
          ) : (
            <form onSubmit={handleUpgradeSubmit} className="space-y-2 mt-2" aria-busy={upgrading}>
              <p className="text-xs text-ink-mute mb-1">
                Set a username and password to keep your level, quests and streak — nothing is reset.
              </p>

              {upgradeError && (
                <div
                  role="alert"
                  className="px-3 py-2 text-xs text-ink border-2 rounded-sm"
                  style={{ background: 'var(--paper-deep)', borderColor: 'var(--accent-rust)' }}
                >
                  {upgradeError}
                </div>
              )}

              <div>
                <label htmlFor="upgrade-username" className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  id="upgrade-username"
                  type="text"
                  name="username"
                  value={upgradeData.username}
                  onChange={handleUpgradeInputChange}
                  className="rpg-input text-sm"
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label htmlFor="upgrade-email" className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                  Email (optional)
                </label>
                <input
                  id="upgrade-email"
                  type="email"
                  name="email"
                  value={upgradeData.email}
                  onChange={handleUpgradeInputChange}
                  className="rpg-input text-sm"
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="upgrade-password" className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  id="upgrade-password"
                  type="password"
                  name="password"
                  value={upgradeData.password}
                  onChange={handleUpgradeInputChange}
                  className="rpg-input text-sm"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label htmlFor="upgrade-confirm-password" className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <input
                  id="upgrade-confirm-password"
                  type="password"
                  name="confirmPassword"
                  value={upgradeData.confirmPassword}
                  onChange={handleUpgradeInputChange}
                  className="rpg-input text-sm"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowUpgradeForm(false); setUpgradeError(''); }}
                  className="rpg-btn-secondary text-xs flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={upgrading} className="rpg-btn-primary text-xs flex-1">
                  {upgrading ? 'Saving…' : 'Save Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );

  const renderPreferencesSection = () => (
    <div className="space-y-3">
      <h3 className="font-display text-base text-ink mb-3">Preferences</h3>
      {[
        { key: 'notifications', label: 'Notifications', desc: 'Receive app notifications and alerts' },
        { key: 'dailyReminder', label: 'Daily Reminder', desc: 'Get reminded to check your tasks daily' },
        { key: 'soundEffects', label: 'Sound Effects', desc: 'Play sounds when completing tasks' },
      ].map(item => (
        <div
          key={item.key}
          className="rpg-window-light flex items-center justify-between px-4 py-3"
        >
          <div>
            <h4 className="text-sm font-semibold text-ink">{item.label}</h4>
            <p className="text-xs text-ink-mute">{item.desc}</p>
          </div>
          <button
            onClick={() => updatePreference(item.key, !preferences[item.key])}
            className="w-11 h-6 rounded-full transition-colors flex-shrink-0 relative"
            style={{
              background: preferences[item.key] ? 'var(--accent-rose-deep)' : 'var(--frame)',
              transition: 'background 200ms',
            }}
            aria-pressed={preferences[item.key]}
          >
            <div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
              style={{ transform: preferences[item.key] ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      ))}

      <div className="rpg-window-light flex items-center justify-between px-4 py-3 mt-3">
        <div>
          <h4 className="text-sm font-semibold text-ink">Replay Tutorial</h4>
          <p className="text-xs text-ink-mute">View the introductory walkthrough again</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('levelup_onboarding_done');
            window.dispatchEvent(new Event('levelup:show-tutorial'));
          }}
          className="rpg-btn-secondary text-xs"
        >
          Replay
        </button>
      </div>
    </div>
  );

  return (
    <div className="paper-bg min-h-screen pb-20 page-enter">
      {/* Header */}
      <div style={{ background: 'var(--paper-deep)', borderBottom: '2px solid var(--frame)' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="font-display text-xl text-ink tracking-wide">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="rpg-window">
              <div className="rpg-header">Navigation</div>
              <div className="p-2 space-y-1">
                {sections.map(({ id, title, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className="w-full text-left px-3 py-2.5 rounded-sm flex items-center gap-2 text-sm transition-colors"
                    style={
                      activeSection === id
                        ? { background: 'var(--paper-shadow)', color: 'var(--ink)', fontWeight: 600 }
                        : { color: 'var(--ink-soft)' }
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {title}
                  </button>
                ))}

                <div
                  className="mt-2 pt-2"
                  style={{ borderTop: '1px solid var(--frame)', opacity: 0.5 }}
                />
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full text-left px-3 py-2.5 rounded-sm flex items-center gap-2 text-sm transition-colors"
                  style={{ color: 'var(--accent-rust)' }}
                >
                  <span>⎋</span>
                  Log Out
                </button>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <div className="rpg-window">
              <div className="rpg-header">
                {activeSection === 'account' ? 'Account' : 'Preferences'}
              </div>
              <div className="px-5 py-4">
                {activeSection === 'account' ? renderAccountSection() : renderPreferencesSection()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); if (onLogout) onLogout(); }}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        type="warning"
        variant="confirmation"
      />

      <BottomNav
        onSettingsClick={() => {}}
        onHomeClick={onNavigateToHome}
        onTaskManagerClick={onNavigateToTaskManager}
        currentPage="settings"
      />
    </div>
  );
}
