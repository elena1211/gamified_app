import { useState, useEffect } from 'react';
import { Star, Trophy, Zap, Users, Brain, Target, Heart } from 'lucide-react';

export default function RewardPopup({ 
  isVisible, 
  onClose, 
  taskTitle = '', 
  rewardPoints = 0, 
  attribute = 'discipline',
  totalPoints = 0 
}) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(true);
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [isVisible, onClose]);

  const getAttributeIcon = (attr) => {
    const icons = {
      intelligence: Brain,
      discipline: Target,
      energy: Zap,
      social: Users,
      wellness: Heart,
      stress: Star
    };
    return icons[attr] || Target;
  };

  const getAttributeEmoji = (attr) => {
    const emojis = {
      intelligence: '🧠',
      discipline: '🎯',
      energy: '⚡',
      social: '👥',
      wellness: '🌟',
      stress: '😰'
    };
    return emojis[attr] || '🎯';
  };

  const getAttributeColor = (attr) => {
    const colors = {
      intelligence: 'from-blue-400 to-blue-600',
      discipline: 'from-purple-400 to-purple-600',
      energy: 'from-yellow-400 to-orange-500',
      social: 'from-green-400 to-green-600',
      wellness: 'from-pink-400 to-pink-600',
      stress: 'from-red-400 to-red-600'
    };
    return colors[attr] || 'from-purple-400 to-purple-600';
  };

  if (!isVisible) return null;

  const IconComponent = getAttributeIcon(attribute);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className={`bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transform transition-all duration-500 ${
          showAnimation ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
      >
        {/* Celebration Animation */}
        <div className="relative mb-6">
          <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${getAttributeColor(attribute)} flex items-center justify-center shadow-lg transform ${
            showAnimation ? 'animate-bounce' : ''
          }`}>
            <IconComponent size={40} className="text-white" />
          </div>
          
          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-2 h-2 bg-yellow-400 rounded-full transform ${
                  showAnimation ? 'animate-ping' : 'opacity-0'
                }`}
                style={{
                  top: `${20 + Math.random() * 60}%`,
                  left: `${20 + Math.random() * 60}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        </div>

        {/* Success Message */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            🎉 Task Completed!
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            "{taskTitle}"
          </p>
        </div>

        {/* Reward Details */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-2xl">{getAttributeEmoji(attribute)}</span>
            <span className="text-lg font-semibold text-gray-800 capitalize">
              {attribute}
            </span>
          </div>
          
          <div className="text-3xl font-bold text-orange-600 mb-1">
            +{rewardPoints}
          </div>
          
          <div className="text-sm text-gray-600">
            Total: {totalPoints} points
          </div>
        </div>

        {/* Motivational Message */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 italic">
            "Great job! Every small step brings you closer to your goals! 🚀"
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
        >
          Continue Journey
        </button>
      </div>
    </div>
  );
}