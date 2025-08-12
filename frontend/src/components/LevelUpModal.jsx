import React from 'react';
import { getAvatarStage, getAvatarSrc } from '../utils/avatar';

const LevelUpModal = ({
  isOpen,
  onClose,
  oldLevel,
  newLevel,
  newExp,
  oldStage,
  newStage
}) => {
  if (!isOpen) return null;

  const stageChanged = oldStage !== newStage;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
        {/* Celebration Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-blue-600 mb-2">
            🎉 Level Up! 🎉
          </h2>
          <div className="text-lg text-gray-700">
            Level {oldLevel} → Level {newLevel}
          </div>
        </div>

        {/* Avatar Display */}
        <div className="mb-6">
          {stageChanged ? (
            <div className="flex justify-center items-center space-x-4">
              <div className="text-center">
                <img
                  src={getAvatarSrc(oldStage)}
                  alt={`Stage ${oldStage}`}
                  className="w-20 h-20 rounded-full border-4 border-gray-300 mx-auto mb-2"
                />
                <div className="text-sm text-gray-500">Before</div>
              </div>

              <div className="text-2xl">→</div>

              <div className="text-center">
                <img
                  src={getAvatarSrc(newStage)}
                  alt={`Stage ${newStage}`}
                  className="w-20 h-20 rounded-full border-4 border-yellow-400 mx-auto mb-2 animate-pulse"
                />
                <div className="text-sm text-yellow-600 font-bold">New Stage!</div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <img
                src={getAvatarSrc(newStage)}
                alt={`Stage ${newStage}`}
                className="w-24 h-24 rounded-full border-4 border-blue-400 mx-auto mb-2"
              />
              <div className="text-sm text-blue-600">Current Avatar</div>
            </div>
          )}
        </div>

        {/* Stage Change Message */}
        {stageChanged && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-lg font-bold text-yellow-800 mb-2">
              🌟 Avatar Evolved! 🌟
            </h3>
            <p className="text-yellow-700">
              Your avatar has evolved to Stage {newStage}!
              {newStage === 2 && " You're making great progress!"}
              {newStage === 3 && " You're becoming a task master!"}
              {newStage === 4 && " You're almost at the top level!"}
              {newStage === 5 && " You've reached the maximum level!"}
            </p>
          </div>
        )}

        {/* Level Progress Info */}
        <div className="mb-6 text-gray-600">
          <div className="text-sm">Current EXP: {newExp}</div>
          {!stageChanged && (
            <div className="text-xs mt-1">
              Keep completing tasks to reach the next stage!
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default LevelUpModal;
