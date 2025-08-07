import { useState } from 'react';
import { ArrowLeft, User, Shield, Bell, Palette, Database, HelpCircle, LogOut, Eye, EyeOff, Trash2, Key, Download, Upload, Moon, Sun, Globe, Smartphone } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { COLORS } from '../config/constants.js';

export default function SystemSettingsPage({ currentUser, onBack, onLogout }) {
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Form states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [accountForm, setAccountForm] = useState({
    deletePassword: ''
  });
  
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    notifications: true,
    soundEffects: true,
    autoSave: true,
    dailyReminder: true,
    weeklyReport: true
  });

  const sections = [
    { id: 'account', title: 'Account Management', icon: User },
    { id: 'security', title: 'Security Settings', icon: Shield },
    { id: 'notifications', title: 'Notification Settings', icon: Bell },
    { id: 'appearance', title: 'Appearance Settings', icon: Palette },
    { id: 'data', title: 'Data Management', icon: Database },
    { id: 'support', title: 'Help & Support', icon: HelpCircle }
  ];

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('New password confirmation does not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setMessage('New password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(API_ENDPOINTS.changePassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage(data.error || 'Password change failed');
      }
    } catch (err) {
      setMessage('Network error, please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountForm.deletePassword) {
      setMessage('Please enter password to confirm deletion');
      return;
    }
    
    if (!window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone!')) {
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(API_ENDPOINTS.deleteAccount, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          password: accountForm.deletePassword
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('Account deleted successfully');
        setTimeout(() => {
          if (onLogout) onLogout();
        }, 2000);
      } else {
        setMessage(data.error || 'Deletion failed');
      }
    } catch (err) {
      setMessage('Network error, please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    // Simulate data export
    const userData = {
      username: currentUser,
      exportDate: new Date().toISOString(),
      settings: preferences,
      note: 'This is your personal data export'
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentUser}_data_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    setMessage('Data export successful!');
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
      
      <div className="border border-red-200 bg-red-50 p-4 rounded-lg">
        <h3 className="font-semibold text-red-800 mb-3 flex items-center">
          <Trash2 className="w-5 h-5 mr-2" />
          Delete Account
        </h3>
        <p className="text-sm text-red-600 mb-4">⚠️ Warning: This action will permanently delete your account and all data, and cannot be undone.</p>
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Enter password to confirm deletion"
            value={accountForm.deletePassword}
            onChange={(e) => setAccountForm({ ...accountForm, deletePassword: e.target.value })}
            className="w-full p-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={handleDeleteAccount}
            disabled={loading || !accountForm.deletePassword}
            className={`w-full p-3 bg-red-600 text-white rounded-lg font-medium ${
              loading || !accountForm.deletePassword ? 'opacity-50' : 'hover:bg-red-700'
            }`}
          >
            {loading ? 'Deleting...' : 'Confirm Account Deletion'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSecuritySection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <Key className="w-5 h-5 mr-2" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Current password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-3 text-gray-500"
            >
              {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="New password (minimum 6 characters)"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-3 text-gray-500"
            >
              {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          <input
            type="password"
            placeholder="Confirm new password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full p-3 bg-pink-600 text-white rounded-lg font-medium ${
              loading ? 'opacity-50' : 'hover:bg-pink-700'
            }`}
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Security Recommendations</h3>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• Change your password regularly</li>
          <li>• Use complex password combinations</li>
          <li>• Avoid using the same password on other websites</li>
          <li>• Ensure your login environment is secure</li>
        </ul>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-4">
      {[
        { key: 'notifications', label: 'Receive Notifications', desc: 'Allow system to send notifications' },
        { key: 'dailyReminder', label: 'Daily Reminder', desc: 'Daily reminders to complete tasks' },
        { key: 'weeklyReport', label: 'Weekly Report', desc: 'Send weekly progress reports' },
        { key: 'soundEffects', label: 'Sound Effects', desc: 'Enable operation sound effects' }
      ].map(item => (
        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-800">{item.label}</h4>
            <p className="text-sm text-gray-600">{item.desc}</p>
          </div>
          <button
            onClick={() => setPreferences({ ...preferences, [item.key]: !preferences[item.key] })}
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

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <Sun className="w-5 h-5 mr-2" />
          Theme Settings
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'light', label: 'Light Theme', icon: Sun },
            { value: 'dark', label: 'Dark Theme', icon: Moon }
          ].map(theme => (
            <button
              key={theme.value}
              onClick={() => setPreferences({ ...preferences, theme: theme.value })}
              className={`p-3 rounded-lg border-2 transition-colors ${
                preferences.theme === theme.value
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <theme.icon className="w-6 h-6 mx-auto mb-2" />
              <span className="text-sm font-medium">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Language Settings
        </h3>
        <select
          value={preferences.language}
          onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
        >
          <option value="en">English</option>
          <option value="zh-TW">繁體中文</option>
          <option value="zh-CN">简体中文</option>
          <option value="ja">日本語</option>
        </select>
      </div>
    </div>
  );

  const renderDataSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Data Management
        </h3>
        <div className="space-y-3">
          <button
            onClick={handleExportData}
            className="w-full p-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center"
          >
            <Download className="w-5 h-5 mr-2" />
            Export Personal Data
          </button>
          
          <label className="w-full p-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center cursor-pointer">
            <Upload className="w-5 h-5 mr-2" />
            Import Data
            <input type="file" accept=".json" className="hidden" />
          </label>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Storage Settings</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Auto Save</p>
            <p className="text-sm text-gray-600">Automatically save your progress</p>
          </div>
          <button
            onClick={() => setPreferences({ ...preferences, autoSave: !preferences.autoSave })}
            className={`w-12 h-6 rounded-full transition-colors ${
              preferences.autoSave ? 'bg-pink-600' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
              preferences.autoSave ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderSupportSection = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3">Help Resources</h3>
        <div className="space-y-2">
          <button className="w-full text-left p-3 bg-white rounded border hover:bg-gray-50">
            📖 User Manual
          </button>
          <button className="w-full text-left p-3 bg-white rounded border hover:bg-gray-50">
            💬 Online Support
          </button>
          <button className="w-full text-left p-3 bg-white rounded border hover:bg-gray-50">
            📧 Feedback
          </button>
          <button className="w-full text-left p-3 bg-white rounded border hover:bg-gray-50">
            🔄 Check for Updates
          </button>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Application Information</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Version: 1.0.0</p>
          <p>Last Updated: 1st January 2024</p>
          <p>Developer: Elena Team</p>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account': return renderAccountSection();
      case 'security': return renderSecuritySection();
      case 'notifications': return renderNotificationsSection();
      case 'appearance': return renderAppearanceSection();
      case 'data': return renderDataSection();
      case 'support': return renderSupportSection();
      default: return renderAccountSection();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-3"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-800">System Settings</h1>
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
                  onClick={onLogout}
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
              {message && (
                <div className={`p-4 rounded-lg mb-6 ${
                  message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {message}
                </div>
              )}
              
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
