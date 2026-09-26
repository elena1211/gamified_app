// How a milestone's completion criteria and progress read on screen.
// The API sends decimals as strings ("1500.50") so they survive the trip
// unrounded; these helpers keep them as strings until they are drawn.

export const COMPLETION_TYPES = [
  { value: 'outcome', label: 'When it happens' },
  { value: 'cumulative', label: 'By repeating a quest' },
  { value: 'measurable', label: 'By reaching a number' },
];

export const DIRECTIONS = [
  { value: 'at_least', label: 'At least' },
  { value: 'at_most', label: 'At most' },
];

const withUnit = (amount, unit) => (unit ? `${amount} ${unit}` : amount);

export function describeTarget(milestone) {
  if (milestone.completion_type === 'cumulative') {
    return `${milestone.target_count} quest completions`;
  }
  if (milestone.completion_type === 'measurable') {
    const direction = milestone.target_direction === 'at_most' ? 'At most' : 'At least';
    return `${direction} ${withUnit(milestone.target_value, milestone.unit)}`;
  }
  return 'Reported when it happens';
}

export function describeProgress(milestone) {
  const progress = milestone.progress;
  if (milestone.completion_type === 'cumulative') {
    return `${progress?.completions ?? 0} of ${milestone.target_count}`;
  }
  if (milestone.completion_type === 'measurable') {
    const latest = progress?.latest_value;
    if (!latest) return 'Nothing reported yet';
    return `${withUnit(latest, milestone.unit)} reported`;
  }
  return milestone.outcome_note || null;
}

// How full the gauge is drawn, from 0 to 1. An at_most target counts down
// towards the number rather than up, so a reading above it is partial
// progress and one at or below it is done.
export function progressFraction(milestone) {
  if (milestone.status === 'completed') return 1;

  if (milestone.completion_type === 'cumulative') {
    const target = Number(milestone.target_count);
    if (!target) return 0;
    return Math.min(1, (milestone.progress?.completions ?? 0) / target);
  }

  if (milestone.completion_type === 'measurable') {
    const target = Number(milestone.target_value);
    const latest = Number(milestone.progress?.latest_value);
    if (!target || !Number.isFinite(latest)) return 0;
    if (milestone.target_direction === 'at_most') {
      return latest <= target ? 1 : Math.min(1, target / latest);
    }
    return Math.min(1, latest / target);
  }

  return 0;
}
