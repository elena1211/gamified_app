import { describeProgress, describeTarget, progressFraction } from '../utils/pathFormat.js';

// What a milestone asks for and how far along it is: the same reading on the
// path itself and on the home screen, so the two can't drift apart.
// An outcome milestone has no number to fill, only a condition to state.
export default function MilestoneProgress({ milestone, colour }) {
  return (
    <>
      <p className="text-xs text-ink-soft mt-1">{describeTarget(milestone)}</p>

      {milestone.completion_type !== 'outcome' && (
        <div className="mt-2">
          {/* The numbers are stated below, so the gauge is decoration. */}
          <div className="stat-gauge-track" aria-hidden>
            <div
              className="stat-gauge-fill"
              style={{ '--fill': progressFraction(milestone), background: colour }}
            />
          </div>
          <p className="text-xs text-ink-soft mt-1">{describeProgress(milestone)}</p>
        </div>
      )}
    </>
  );
}
