import { useState } from 'react';
import { User, LogOut, Bell } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import BottomNav from '../components/BottomNav.jsx';

/**
 * System Settings Page component
 * Handles user account, security, notifications, and support settings
 */
export default function SystemSettingsPage({ currentUser, onLogout, onNavigateToHome, onNavigateToTaskManager }) {
  const [activeSection, setActiveSection] = useState('account');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [preferences, setPreferences] = useState({
    notifications: localStorage.getItem('notifications') !== 'false',
    soundEffects: localStorage.getItem('soundEffects') !== 'false',
    dailyReminder: localStorage.getItem('dailyReminder') !== 'false'
  });

  const sections = [
    { id: 'account', title: 'Account', icon: User },
    { id: 'preferences', title: 'Preferences', icon: Bell }
  ];

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    if (onLogout) onLogout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(key, value);
  };

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Account Information
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">Username: </span>{currentUser}</p>
          <p><span className="font-medium">Registration Date: </span>1st January 2024</p>
          <p><span className="font-medium">Last Login: </span>Today</p>
          <p><span className="font-medium">Account Status: </span><span className="text-green-600">Active</span></p>
        </div>
      </div>
    </div>
  );

  const renderPreferencesSection = () => (
    <div className="space-y-4">
      {[
        { key: 'notifications', label: 'Notifications', desc: 'Receive app notifications and alerts' },
        { key: 'dailyReminder', label: 'Daily Reminder', desc: 'Get reminded to check your tasks daily' },
        { key: 'soundEffects', label: 'Sound Effects', desc: 'Play sounds when completing tasks' }
      ].map(item => (
        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-800">{item.label}</h4>
            <p className="text-sm text-gray-600">{item.desc}</p>
          </div>
          <button
            onClick={() => updatePreference(item.key, !preferences[item.key])}
            className={`w-12 h-6 rounded-full transition-colors ${
              preferences[item.key] ? 'bg-pink-600' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
              preferences[item.key] ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account': return renderAccountSection();
      case 'preferences': return renderPreferencesSection();
      default: return renderAccountSection();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">Settings</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-center ${
                    activeSection === section.id
                      ? 'bg-pink-100 text-pink-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <section.icon className="w-5 h-5 mr-3" />
                  {section.title}
                </button>
              ))}

              <div className="border-t pt-2 mt-4">
                <button
                  onClick={handleLogoutClick}
                  className="w-full text-left p-3 rounded-lg transition-colors flex items-center text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Log Out
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        type="warning"
        variant="confirmation"
      />

      <BottomNav
        onSettingsClick={() => {}} // Empty function since we're already on settings page
        onHomeClick={onNavigateToHome}
        onTaskManagerClick={onNavigateToTaskManager}
        currentPage="settings"
      />
    </div>
  );
}
