import { useState, useEffect } from 'react';
import { cleanTaskTitle } from '../utils/taskUtils';

export default function TimeLimitedTaskPopup({ task, onAccept, onReject, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(task.duration);

  useEffect(() => {
    if (timeLeft <= 0) { onTimeUp(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const urgency = timeLeft <= 10;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4">
      <div className="rpg-window max-w-sm w-full">
        <div
          className="rpg-header justify-center text-sm"
          style={{
            background: urgency
              ? 'linear-gradient(180deg, var(--accent-rust) 0%, #8B2C1A 100%)'
              : 'linear-gradient(180deg, var(--frame) 0%, var(--frame-deep) 100%)',
          }}
        >
          ⚡ Time-Limited Quest
        </div>

        <div className="px-5 py-4">
          {/* Task details */}
          <div
            className="rounded-sm px-4 py-3 mb-4"
            style={{ background: 'var(--paper-deep)', border: '1px solid var(--frame)' }}
          >
            <h3 className="font-semibold text-ink text-base mb-1 text-center">
              {cleanTaskTitle(task.title)}
            </h3>
            {task.description && (
              <p className="text-xs text-ink-soft text-center">{task.description}</p>
            )}
          </div>

          {/* Countdown */}
          <div className="text-center mb-4">
            <div
              className="font-display text-4xl tabular-nums mb-1"
              style={{ color: urgency ? 'var(--accent-rust)' : 'var(--accent-gold-deep)' }}
            >
              {formatTime(timeLeft)}
            </div>
            <p className="text-xs text-ink-mute uppercase tracking-widest">Time Remaining</p>
          </div>

          {/* Reward / penalty */}
          <div className="space-y-1 mb-5 text-sm">
            <div className="flex justify-between">
              <span className="text-sage">✦ Reward:</span>
              <span className="text-ink font-medium">{task.reward}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rust">✗ Penalty:</span>
              <span className="text-ink font-medium">{task.penalty}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onAccept} className="rpg-btn-sage flex-1">Accept</button>
            <button onClick={onReject} className="rpg-btn-secondary flex-1">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}
