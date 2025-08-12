import { useState, useEffect } from 'react';
import { getAvatarSrc, getAvatarTitle } from '../utils/avatar';

export default function LevelUpNotification({ isOpen, newLevel, onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const avatarSrc = getAvatarSrc(newLevel);
  const avatarTitle = getAvatarTitle(newLevel);

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl p-8 max-w-sm mx-4 text-center transform transition-all duration-300 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <div className="text-6xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Level Up!</h2>
          <p className="text-gray-600">You've reached level {newLevel}!</p>
        </div>

        <div className="mb-6">
          <div className="relative inline-block">
            <img
              src={avatarSrc}
              alt={`${avatarTitle} Avatar`}
              className="w-24 h-24 rounded-full border-4 border-yellow-400 object-cover mx-auto"
              onError={(e) => {
                e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxMDAiIGZpbGw9IiNmYzkxYmYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iODAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNTAiIHJ4PSI0MCIgcnk9IjMwIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo=";
              }}
            />
            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-800 text-sm px-3 py-1 rounded-full font-bold shadow-lg">
              {newLevel}
            </div>
          </div>
          <p className="text-lg font-semibold text-purple-600 mt-3">
            {avatarTitle}
          </p>
        </div>

        <button
          onClick={onClose}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
