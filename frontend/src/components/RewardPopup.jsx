import { useState, useEffect } from 'react';

const ATTR_META = {
  intelligence: { emoji: '🧠', color: '#4A7AB5' },
  discipline:   { emoji: '🎯', color: '#8B6F47' },
  energy:       { emoji: '⚡', color: '#C4921A' },
  social:       { emoji: '👥', color: '#5A9A6A' },
  wellness:     { emoji: '🌟', color: '#B57787' },
  stress:       { emoji: '😰', color: '#B85C42' },
};

export default function RewardPopup({ isVisible, onClose, taskTitle = '', rewardPoints = 0, attribute = 'discipline', totalPoints = 0 }) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(true);
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const meta = ATTR_META[attribute] ?? ATTR_META.discipline;

  return (
    <div className="backdrop-enter fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      {/* Keeps its own showAnimation-driven transition instead of .modal-enter:
          it needs to stay mounted (for the 5s auto-dismiss timer above) and
          animate via a prop change, not via mount/unmount like the other modals. */}
      <div
        className={`rpg-window max-w-sm w-full text-center transition-all duration-500 ${
          showAnimation ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        <div
          className="rpg-header justify-center"
          style={{ background: 'linear-gradient(180deg, var(--accent-gold) 0%, var(--accent-gold-deep) 100%)', color: 'var(--frame-deep)' }}
        >
          ✦ Quest Complete!
        </div>

        <div className="px-6 py-5">
          {/* Attribute icon */}
          <div className="mb-4">
            <div
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl shadow-md ${
                showAnimation ? 'animate-bounce' : ''
              }`}
              style={{ background: `${meta.color}22`, border: `3px solid ${meta.color}` }}
            >
              {meta.emoji}
            </div>
          </div>

          {/* Task title */}
          <p className="text-sm text-ink-soft italic mb-4">"{taskTitle}"</p>

          {/* Reward badge */}
          <div
            className="inline-block px-5 py-3 rounded-sm mb-4"
            style={{ background: '#FFF9E6', border: '2px solid var(--accent-gold)' }}
          >
            <div
              className="font-display text-3xl tabular-nums"
              style={{ color: 'var(--accent-gold-deep)' }}
            >
              +{rewardPoints}
            </div>
            <div className="text-xs text-ink-soft capitalize mt-0.5">{attribute}</div>
          </div>

          <p className="text-xs text-ink-mute mb-5">
            Total: <span className="tabular-nums font-semibold">{totalPoints}</span> points
          </p>

          <button onClick={onClose} className="rpg-btn-gold w-full">
            Continue Journey
          </button>
        </div>
      </div>
    </div>
  );
}
