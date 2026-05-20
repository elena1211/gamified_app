import { useState } from 'react';

const SLIDES = [
  {
    title: 'Welcome to LevelUp',
    body: 'Treat life like an RPG. Complete real-world tasks to gain experience, level up your character, and watch your stats grow.',
    icon: '◆',
  },
  {
    title: 'Daily Quests & Stats',
    body: 'Each day brings a fresh set of quests. Every quest you complete raises one of six attributes — Intelligence, Discipline, Energy, Social, Wellness, or Stress.',
    icon: '◈',
  },
  {
    title: 'Time-Limited Micro Quests',
    body: 'Occasionally a short quest appears with a timer. Tap Accept to take on the challenge, or Decline if it is bad timing — no penalty for skipping a preview.',
    icon: '⚡',
  },
  {
    title: 'The System',
    body: 'Open the System tab to chat with your AI companion. Tell it what you are doing today and it will generate quests tailored to your situation. Skip too many days and the System will issue penalties.',
    icon: '✦',
  },
];

const STORAGE_KEY = 'levelup_onboarding_done';

export function hasSeenOnboarding() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, 'true');
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function OnboardingTutorial({ onComplete }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const finish = () => {
    markOnboardingDone();
    onComplete?.();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div className="rpg-window max-w-md w-full">
        <div className="rpg-header">
          Tutorial — Step {index + 1} of {SLIDES.length}
        </div>

        <div className="px-6 py-6 text-center">
          <div
            className="text-5xl mb-4 font-display"
            style={{ color: 'var(--accent-gold-deep)' }}
          >
            {slide.icon}
          </div>
          <h2 className="font-display text-xl text-ink mb-3 tracking-wide">
            {slide.title}
          </h2>
          <p className="text-sm text-ink-soft leading-relaxed mb-6">
            {slide.body}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  background: i === index ? 'var(--accent-gold-deep)' : 'var(--frame)',
                  opacity: i === index ? 1 : 0.4,
                }}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {index > 0 && (
              <button
                onClick={() => setIndex(index - 1)}
                className="rpg-btn-secondary flex-1"
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? finish : () => setIndex(index + 1)}
              className="rpg-btn-primary flex-1"
            >
              {isLast ? 'Begin' : 'Next →'}
            </button>
          </div>

          <button
            onClick={finish}
            className="mt-4 text-xs text-ink-mute hover:text-ink underline transition-colors"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
