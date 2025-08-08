import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function TimeLimitedTaskPopup({ task, onAccept, onReject, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(task.duration);
  const { t } = useTranslation('dashboard');

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl relative"
        style={{
          zIndex: 10000,
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          maxWidth: '24rem',
          margin: '0 1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">⚡</div>
          <h2 className="text-xl font-bold text-gray-800">{t('timeLimitedQuest')}</h2>
        </div>

        <div className="bg-yellow-50 rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-gray-800 mb-2 text-center">{task.title}</h3>
          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 mb-1">
              {formatTime(timeLeft)}
            </div>
            <p className="text-xs text-gray-500">{t('timeRemaining')}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-600">✅ {t('reward')}:</span>
            <span className="text-sm font-medium">{task.reward}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-red-600">❌ {t('penalty')}:</span>
            <span className="text-sm font-medium">{task.penalty}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition-colors"
          >
            {t('acceptChallenge')}
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-medium transition-colors"
          >
            {t('dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
