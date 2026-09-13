import { describe, it, expect } from 'vitest';
import { cleanTaskTitle } from '../taskUtils';

describe('cleanTaskTitle', () => {
  it('strips the timestamp suffix time-limited tasks are stored with', () => {
    expect(cleanTaskTitle('Stretch for two minutes - 14:05:09')).toBe('Stretch for two minutes');
  });

  it('leaves a hyphen that is part of the title alone', () => {
    // Only the exact " - HH:MM:SS" shape is removed, the same pattern the
    // backend strips when it looks a task up by title.
    expect(cleanTaskTitle('Read - chapter 3')).toBe('Read - chapter 3');
  });

  it.each([null, undefined, '', '   ', 42])('shows a placeholder for an unusable title (%s)', (title) => {
    expect(cleanTaskTitle(title)).toBe('Task Unavailable');
  });

  it('does not show a bare id as though it were a title', () => {
    expect(cleanTaskTitle('12345')).toBe('Task Loading...');
  });
});
