import { useState } from 'react';
import { X, User, Lock, Trash2, LogOut, Shield } from 'lucide-react';
import { COLORS, ANIMATION_CLASSES, LAYOUT_CLASSES } from '../config/constants.js';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';

export default function SystemSettingsModal({ isOpen, onClose, currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('account');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  if (!isOpen) return null;

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await apiRequest(API_ENDPOINTS.changePassword, {
        method: 'POST',
        body: JSON.stringify({
          username: currentUser,
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });
      
      setSuccess('Password changed successfully!');
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError('');
    
    try {
      await apiRequest(API_ENDPOINTS.deleteAccount, {
        method: 'POST',
        body: JSON.stringify({
          username: currentUser
        })
      });
      
      setShowDeleteConfirm(false);
      onClose();
      onLogout(); // Automatically log out after account deletion
    } catch (err) {
      setError(err.message);
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${LAYOUT_CLASSES.card} max-w-md w-full max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">System Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'account' 
                ? 'text-pink-600 border-b-2 border-pink-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User size={16} className="inline mr-2" />
            Account
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'security' 
                ? 'text-pink-600 border-b-2 border-pink-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield size={16} className="inline mr-2" />
            Security
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
          
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Current user: <span className="font-medium text-gray-800">{currentUser}</span>
              </div>
              
              {/* Change Password */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">Change Password</h3>
                    <p className="text-sm text-gray-600">Update your login password</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className={`${COLORS.button.primary} text-white px-4 py-2 rounded-lg text-sm ${ANIMATION_CLASSES.button}`}
                  >
                    <Lock size={16} className="inline mr-1" />
                    Change
                  </button>
                </div>
                
                {showPasswordForm && (
                  <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                    <input
                      type="password"
                      name="currentPassword"
                      placeholder="Current password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className={LAYOUT_CLASSES.input}
                      required
                    />
                    <input
                      type="password"
                      name="newPassword"
                      placeholder="New password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className={LAYOUT_CLASSES.input}
                      required
                    />
                    <input
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className={LAYOUT_CLASSES.input}
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className={`${COLORS.button.success} text-white px-4 py-2 rounded text-sm ${loading ? 'opacity-50' : ''}`}
                      >
                        {loading ? 'Changing...' : 'Confirm Change'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className={`${COLORS.button.secondary} text-gray-700 px-4 py-2 rounded text-sm`}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Logout */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">Log Out</h3>
                    <p className="text-sm text-gray-600">End your current session</p>
                  </div>
                  <button
                    onClick={onLogout}
                    className={`${COLORS.button.secondary} text-gray-700 px-4 py-2 rounded-lg text-sm ${ANIMATION_CLASSES.button}`}
                  >
                    <LogOut size={16} className="inline mr-1" />
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              {/* Delete Account */}
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-red-800">Delete Account</h3>
                    <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className={`${COLORS.button.danger} text-white px-4 py-2 rounded-lg text-sm ${ANIMATION_CLASSES.button}`}
                  >
                    <Trash2 size={16} className="inline mr-1" />
                    Delete
                  </button>
                </div>
                
                {showDeleteConfirm && (
                  <div className="mt-4 p-4 bg-white border border-red-300 rounded">
                    <p className="text-sm text-red-800 mb-3">
                      ⚠️ This action cannot be undone! Are you sure you want to delete your account?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={loading}
                        className={`${COLORS.button.danger} text-white px-4 py-2 rounded text-sm ${loading ? 'opacity-50' : ''}`}
                      >
                        {loading ? 'Deleting...' : 'Confirm Deletion'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className={`${COLORS.button.secondary} text-gray-700 px-4 py-2 rounded text-sm`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy Settings */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Privacy Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm text-gray-600">Allow data collection to improve services</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm text-gray-600">Enable location-based services</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
