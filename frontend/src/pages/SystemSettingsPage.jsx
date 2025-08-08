import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Shield, Bell, Palette, LogOut, Eye, EyeOff, Trash2, Key, Moon, Sun, Globe } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api.js';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import Modal from '../components/Modal.jsx';

/**
 * System Settings Page component
 * Handles user account, security, notifications, appearance, and support settings
 */
export default function SystemSettingsPage({ currentUser, onBack, onLogout }) {
  const { t, i18n } = useTranslation(['common', 'settings']);
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
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
    theme: localStorage.getItem('theme') || 'light',
    notifications: localStorage.getItem('notifications') !== 'false',
    soundEffects: localStorage.getItem('soundEffects') !== 'false',
    autoSave: localStorage.getItem('autoSave') !== 'false',
    dailyReminder: localStorage.getItem('dailyReminder') !== 'false',
    weeklyReport: localStorage.getItem('weeklyReport') !== 'false'
  });

  // Initialize theme on component mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

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

  const sections = [
    { id: 'account', title: t('settings:account'), icon: User },
    { id: 'security', title: t('settings:security'), icon: Shield },
    { id: 'notifications', title: t('settings:notificationSettings'), icon: Bell },
    { id: 'appearance', title: t('settings:appearance'), icon: Palette }
  ];

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage(t('settings:passwordMismatch'));
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setMessage(t('settings:passwordTooShort'));
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
        setMessage(t('settings:passwordChanged'));
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage(data.error || t('settings:passwordChangeError'));
      }
    } catch {
      setMessage(t('settings:networkError'));
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
        // Clear all user data from localStorage
        localStorage.removeItem('currentUser');
        localStorage.clear(); // Clear all settings as well
        setTimeout(() => {
          if (onLogout) onLogout();
        }, 2000);
      } else {
        setMessage(data.error || 'Deletion failed');
      }
    } catch {
      setMessage('Network error, please try again');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(key, value);
    
    // Apply theme changes immediately
    if (key === 'theme') {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }
    
    // Use i18n to change language
    if (key === 'language') {
      i18n.changeLanguage(value);
    }
    
    const settingName = key.charAt(0).toUpperCase() + key.slice(1);
    setMessage(t('settings:settingUpdated', { setting: settingName }));
    setTimeout(() => setMessage(''), 3000);
  };

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
          <User className="w-5 h-5 mr-2" />
          {t('settings:accountInformation')}
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">{t('settings:username')}: </span>{currentUser}</p>
          <p><span className="font-medium">{t('settings:registrationDate')}: </span>1st January 2024</p>
          <p><span className="font-medium">{t('settings:lastLogin')}: </span>Today</p>
          <p><span className="font-medium">{t('settings:accountStatus')}: </span><span className="text-green-600">{t('settings:active')}</span></p>
        </div>
      </div>
      
      <div className="border border-red-200 bg-red-50 p-4 rounded-lg">
        <h3 className="font-semibold text-red-800 mb-3 flex items-center">
          <Trash2 className="w-5 h-5 mr-2" />
          {t('settings:deleteAccount')}
        </h3>
        <p className="text-sm text-red-600 mb-4">{t('settings:deleteAccountWarning')}</p>
        <div className="space-y-3">
          <input
            type="password"
            placeholder={t('settings:enterPasswordToConfirm')}
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
            {loading ? t('settings:deleting') : t('settings:confirmAccountDeletion')}
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
          {t('settings:changePassword')}
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              placeholder={t('settings:currentPassword')}
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
              placeholder={t('settings:newPassword')}
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
            placeholder={t('settings:confirmNewPassword')}
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
            {loading ? t('settings:changing') : t('settings:changePassword')}
          </button>
        </form>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">{t('settings:securityRecommendations')}</h3>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>{t('settings:securityTip1')}</li>
          <li>{t('settings:securityTip2')}</li>
          <li>{t('settings:securityTip3')}</li>
          <li>{t('settings:securityTip4')}</li>
        </ul>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-4">
      {[
        { key: 'notifications', label: t('settings:receiveNotifications'), desc: t('settings:receiveNotificationsDesc') },
        { key: 'dailyReminder', label: t('settings:dailyReminder'), desc: t('settings:dailyReminderDesc') },
        { key: 'weeklyReport', label: t('settings:weeklyReport'), desc: t('settings:weeklyReportDesc') },
        { key: 'soundEffects', label: t('settings:soundEffects'), desc: t('settings:soundEffectsDesc') }
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

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <Sun className="w-5 h-5 mr-2" />
          {t('settings:themeSettings')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'light', label: t('settings:lightTheme'), icon: Sun },
            { value: 'dark', label: t('settings:darkTheme'), icon: Moon }
          ].map(theme => (
            <button
              key={theme.value}
              onClick={() => updatePreference('theme', theme.value)}
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
          {t('settings:language')}
        </h3>
        <LanguageSwitcher />
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-3">{t('settings:autoSaveSettings')}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('settings:autoSavePreferences')}</p>
            <p className="text-sm text-gray-600">{t('settings:autoSaveDesc')}</p>
          </div>
          <button
            onClick={() => updatePreference('autoSave', !preferences.autoSave)}
            className={`w-12 h-6 rounded-full transition-colors ${
              preferences.autoSave ? 'bg-pink-600' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
              preferences.autoSave ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {t('settings:autoSaveNote')}
        </p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account': return renderAccountSection();
      case 'security': return renderSecuritySection();
      case 'notifications': return renderNotificationsSection();
      case 'appearance': return renderAppearanceSection();
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
            <h1 className="text-xl font-bold text-gray-800">{t('settings:systemSettings')}</h1>
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
                  {t('settings:logOut')}
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

      {/* Logout Confirmation Dialog */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        title={t('settings:confirmLogout')}
        message={t('settings:logoutMessage')}
        confirmText={t('settings:confirmLogoutBtn')}
        cancelText={t('settings:cancel')}
        type="warning"
        variant="confirmation"
      />
    </div>
  );
}