import { useState } from 'react';
import { User, Bell } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import BottomNav from '../components/BottomNav.jsx';

export default function SystemSettingsPage({ currentUser, onLogout, onNavigateToHome, onNavigateToTaskManager }) {
  const [activeSection, setActiveSection] = useState('account');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

  const renderAccountSection = () => (
    <div className="space-y-3">
      <h3 className="font-display text-base text-ink mb-3">Account Information</h3>
      <div className="rpg-window-light px-4 py-3 text-sm space-y-2">
        {[
          ['Username', currentUser],
          ['Registration Date', '1 January 2024'],
          ['Last Login', 'Today'],
          ['Account Status', <span key="s" className="text-sage">Active</span>],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-ink-mute">{label}</span>
            <span className="text-ink font-medium">{value}</span>
          </div>
        ))}
      </div>
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
