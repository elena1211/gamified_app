import { describe, it, expect } from 'vitest';
import { describeProgress, describeTarget, progressFraction } from '../pathFormat';

const cumulative = (changes = {}) => ({
  completion_type: 'cumulative',
  status: 'active',
  target_count: 40,
  progress: { completions: 10 },
  ...changes,
});

const measurable = (changes = {}) => ({
  completion_type: 'measurable',
  status: 'active',
  target_value: '1500.50',
  target_direction: 'at_least',
  unit: 'GBP',
  progress: { latest_value: '750.25' },
  ...changes,
});

const outcome = (changes = {}) => ({
  completion_type: 'outcome',
  status: 'active',
  outcome_note: '',
  progress: null,
  ...changes,
});

describe('describeTarget', () => {
  it('counts completions for a cumulative milestone', () => {
    expect(describeTarget(cumulative())).toBe('40 quest completions');
  });

  it('reads a measurable target in its own direction and unit', () => {
    expect(describeTarget(measurable())).toBe('At least 1500.50 GBP');
    expect(describeTarget(measurable({ target_direction: 'at_most' }))).toBe('At most 1500.50 GBP');
  });

  it('drops the unit when there isn\'t one', () => {
    expect(describeTarget(measurable({ unit: '' }))).toBe('At least 1500.50');
  });

  it('says an outcome is reported', () => {
    expect(describeTarget(outcome())).toBe('Reported when it happens');
  });
});

describe('describeProgress', () => {
  it('reads a cumulative count against its target', () => {
    expect(describeProgress(cumulative())).toBe('10 of 40');
  });

  it('counts nothing as zero rather than leaving it blank', () => {
    expect(describeProgress(cumulative({ progress: null }))).toBe('0 of 40');
  });

  it('shows the latest reading, or says none has been made', () => {
    expect(describeProgress(measurable())).toBe('750.25 GBP reported');
    expect(describeProgress(measurable({ progress: null }))).toBe('Nothing reported yet');
  });

  it('shows an outcome note once it exists', () => {
    expect(describeProgress(outcome())).toBeNull();
    expect(describeProgress(outcome({ outcome_note: 'Offer accepted' }))).toBe('Offer accepted');
  });
});

describe('progressFraction', () => {
  it('fills a completed milestone whatever its type', () => {
    expect(progressFraction(outcome({ status: 'completed' }))).toBe(1);
    expect(progressFraction(cumulative({ status: 'completed', progress: null }))).toBe(1);
  });

  it('fills a cumulative milestone by its share of the target', () => {
    expect(progressFraction(cumulative())).toBeCloseTo(0.25);
  });

  it('never overflows when there are more completions than the target', () => {
    expect(progressFraction(cumulative({ progress: { completions: 80 } }))).toBe(1);
  });

  it('counts an at_least reading up towards the target', () => {
    expect(progressFraction(measurable({ target_value: '1000', progress: { latest_value: '250' } })))
      .toBeCloseTo(0.25);
  });

  it('counts an at_most reading down towards the target', () => {
    // 30 minutes wanted, 40 reported: closer than 60 would be, and not done yet.
    const slow = measurable({
      target_direction: 'at_most', target_value: '30', progress: { latest_value: '40' },
    });
    expect(progressFraction(slow)).toBeCloseTo(0.75);
    expect(progressFraction({ ...slow, progress: { latest_value: '30' } })).toBe(1);
  });

  it('stays at zero when there is nothing to divide by', () => {
    expect(progressFraction(cumulative({ target_count: 0, progress: { completions: 3 } }))).toBe(0);
    expect(progressFraction(measurable({ progress: null }))).toBe(0);
    expect(progressFraction(outcome())).toBe(0);
  });
});
