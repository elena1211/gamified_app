// Onboarding state lives in localStorage so the first-run tutorial only shows
// once per browser. Kept out of the component file so importing these helpers
// doesn't pull in the tutorial UI — and so Settings can reset it without
// duplicating the storage key.
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
