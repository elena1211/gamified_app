import { X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Unified modal component for all dialog types
 * Replaces both ConfirmDialog and WarningPopup
 * Supports confirmation dialogs, warnings, and game penalties
 */
export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message = "Are you sure you want to proceed with this operation?",
  confirmText,
  cancelText,
  type = "warning", // warning, danger, success, game-penalty
  variant = "confirmation", // confirmation, notification
  showCloseButton = true,
  penalty = null, // For game penalty notifications
}) {
  const { t } = useTranslation(['common', 'dashboard']);
  
  if (!isOpen) return null;

  // Set default values using translations
  const defaultTitle = title || t('common:confirm');
  const defaultConfirmText = confirmText || t('common:confirm');
  const defaultCancelText = cancelText || t('common:cancel');

  const isGamePenalty = type === 'game-penalty';
  const isNotification = variant === 'notification';

  const getIcon = () => {
    if (isGamePenalty) {
      // Game-specific emojis for penalties
      return (
        <div className="text-6xl mb-2">
          {defaultTitle.includes(t('dashboard:quest.questDismissed')) ? '😰' : '⏰'}
        </div>
      );
    }

    // Standard icons for other dialogs
    switch (type) {
      case 'danger':
        return <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />;
      default:
        return <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />;
    }
  };

  const getButtonColors = () => {
    if (isGamePenalty) {
      return 'bg-blue-500 hover:bg-blue-600';
    }

    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      default:
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
    }
  };

  const getTitleColor = () => {
    if (isGamePenalty) return 'text-red-600';
    return 'text-gray-900';
  };

  const getMessageContent = () => {
    if (isGamePenalty && penalty) {
      return (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="text-center">
              <p className="text-red-800 font-medium mb-2">{message}</p>
              <div className="text-red-600">
                <span className="font-semibold">{t('dashboard:quest.penalty')}:</span>
                <span className="ml-1">{penalty}</span>
              </div>
            </div>
          </div>
          <div className="text-center mb-6">
            <p className="text-gray-600 text-sm">
              {defaultTitle.includes(t('dashboard:quest.questDismissed'))
                ? "Remember to be brave next time!"
                : "Act faster next time!"
              }
            </p>
          </div>
        </>
      );
    }

    return (
      <p className="text-gray-600 text-center mb-6">
        {message}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{zIndex: isGamePenalty ? 9999 : 10001}}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        {showCloseButton && (
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Icon */}
        <div className="text-center">
          {getIcon()}
        </div>

        {/* Title */}
        <h3 className={`text-lg font-semibold text-center mb-3 ${getTitleColor()}`}>
          {defaultTitle}
        </h3>

        {/* Message */}
        {getMessageContent()}

        {/* Buttons */}
        <div className={`flex ${isNotification ? 'justify-center' : 'space-x-3'}`}>
          {!isNotification && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
            >
              {defaultCancelText}
            </button>
          )}
          <button
            onClick={onConfirm || onClose}
            className={`${isNotification ? 'w-full' : 'flex-1'} px-4 py-2 text-white rounded-lg transition-colors font-medium ${getButtonColors()}`}
          >
            {isGamePenalty ? "I understand" : defaultConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
