import { Check, Lock } from 'lucide-react';
import { describeProgress, describeTarget, progressFraction } from '../utils/pathFormat.js';

const STATUS_LABEL = {
  completed: 'Reached',
  active: 'In progress',
  locked: 'Locked',
};

const STATUS_COLOUR = {
  completed: 'var(--accent-sage)',
  active: 'var(--accent-gold-deep)',
  locked: 'var(--ink-mute)',
};

// One step of the route. The marker carries the status for sighted readers;
// the status word is spelled out beside it so it doesn't rest on colour alone.
export default function PathMilestone({ milestone, isLast }) {
  const { status } = milestone;
  const colour = STATUS_COLOUR[status];
  const progress = describeProgress(milestone);

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <span
          className="w-7 h-7 flex items-center justify-center text-xs font-semibold"
          style={{
            background: status === 'locked' ? 'var(--paper)' : colour,
            color: status === 'locked' ? 'var(--ink-mute)' : 'var(--paper)',
            border: `2px solid ${colour}`,
            transform: 'rotate(45deg)',
          }}
        >
          <span style={{ transform: 'rotate(-45deg)' }}>
            {status === 'completed' ? <Check size={14} /> : status === 'locked' ? <Lock size={12} /> : milestone.position}
          </span>
        </span>
        {!isLast && (
          <span
            className="flex-1 w-0.5 my-1"
            style={{ background: status === 'completed' ? 'var(--accent-sage)' : 'var(--frame)', opacity: 0.5 }}
          />
        )}
      </div>

      <div
        className="rpg-window-light flex-1 px-4 py-3 mb-3"
        aria-current={status === 'active' ? 'step' : undefined}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-base text-ink">{milestone.title}</h3>
          <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: colour }}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        {milestone.description && (
          <p className="text-sm text-ink-soft mt-1">{milestone.description}</p>
        )}

        <p className="text-xs text-ink-mute mt-2">{describeTarget(milestone)}</p>

        {milestone.completion_type !== 'outcome' && (
          <div className="mt-2">
            <div className="stat-gauge-track">
              <div
                className="stat-gauge-fill"
                style={{ '--fill': progressFraction(milestone), background: colour }}
              />
            </div>
            <p className="text-xs text-ink-soft mt-1">{progress}</p>
          </div>
        )}

        {milestone.completion_type === 'outcome' && progress && (
          <p className="text-sm text-ink-soft mt-2 italic">“{progress}”</p>
        )}
      </div>
    </li>
  );
}
