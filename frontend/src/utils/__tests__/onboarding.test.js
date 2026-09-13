import { describe, it, expect, beforeEach } from 'vitest';
import { hasSeenOnboarding, markOnboardingDone, resetOnboarding } from '../onboarding';

describe('onboarding state', () => {
  beforeEach(() => localStorage.clear());

  it('is unseen in a fresh browser', () => {
    expect(hasSeenOnboarding()).toBe(false);
  });

  it('stays seen once marked done', () => {
    markOnboardingDone();
    expect(hasSeenOnboarding()).toBe(true);
  });

  it('can be reset from Settings so the tutorial shows again', () => {
    markOnboardingDone();
    resetOnboarding();
    expect(hasSeenOnboarding()).toBe(false);
  });
});
