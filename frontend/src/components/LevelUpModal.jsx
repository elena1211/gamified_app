import { getAvatarSrc } from '../utils/avatar';

export default function LevelUpModal({ isOpen, onClose, oldLevel, newLevel, newExp, oldStage, newStage }) {
  if (!isOpen) return null;

  const stageChanged = oldStage !== newStage;

  const stageMessages = {
    2: "You're making great progress!",
    3: "You're becoming a quest master!",
    4: "You're almost at the summit!",
    5: "You've reached the pinnacle!",
  };

  return (
    <div className="backdrop-enter fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="rpg-window level-pulse max-w-sm w-full text-center">
        <div
          className="rpg-header justify-center text-base"
          style={{ background: 'linear-gradient(180deg, var(--accent-gold) 0%, var(--accent-gold-deep) 100%)', color: 'var(--frame-deep)' }}
        >
          ★ Level Up! ★
        </div>

        <div className="px-6 py-5">
          <div className="font-display text-2xl text-gold mb-1">
            Level {oldLevel} → Level {newLevel}
          </div>
          <p className="text-xs text-ink-mute mb-5">Well done — keep going!</p>

          {/* Avatar display */}
          <div className="mb-5 flex justify-center items-center gap-6">
            {stageChanged ? (
              <>
                <div className="text-center">
                  <img
                    src={getAvatarSrc(oldLevel)}
                    alt={`Stage ${oldStage}`}
                    className="w-20 h-20 mx-auto mb-1 object-contain"
                    style={{ border: '3px solid var(--frame)', borderRadius: 4, background: 'var(--paper-deep)' }}
                  />
                  <span className="text-xs text-ink-mute">Before</span>
                </div>
                <span className="text-ink-mute text-lg">→</span>
                <div className="text-center">
                  <img
                    src={getAvatarSrc(newLevel)}
                    alt={`Stage ${newStage}`}
                    className="w-20 h-20 mx-auto mb-1 object-contain animate-pulse"
                    style={{ border: '3px solid var(--accent-gold)', borderRadius: 4, background: '#FFF9E6' }}
                  />
                  <span className="text-xs text-gold font-semibold">Evolved!</span>
                </div>
              </>
            ) : (
              <div className="text-center">
                <img
                  src={getAvatarSrc(newLevel)}
                  alt={`Stage ${newStage}`}
                  className="w-24 h-24 mx-auto mb-1 object-contain"
                  style={{ border: '3px solid var(--frame)', borderRadius: 4, background: 'var(--paper-deep)' }}
                />
                <span className="text-xs text-ink-soft">Current avatar</span>
              </div>
            )}
          </div>

          {stageChanged && (
            <div
              className="mb-5 px-4 py-3 rounded-sm text-sm"
              style={{ background: '#FFF9E6', border: '2px solid var(--accent-gold)', color: 'var(--frame-deep)' }}
            >
              <p className="font-semibold mb-1">✦ Avatar Evolved!</p>
              <p>{stageMessages[newStage] ?? 'A new stage awaits!'}</p>
            </div>
          )}

          <div className="text-xs text-ink-mute mb-5">
            Current EXP: <span className="text-gold font-semibold tabular-nums">{newExp}</span>
            {!stageChanged && (
              <p className="mt-1">Keep completing quests to reach the next stage!</p>
            )}
          </div>

          <button onClick={onClose} className="rpg-btn-gold w-full">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
