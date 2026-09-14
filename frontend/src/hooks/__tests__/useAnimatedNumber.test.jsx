import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useAnimatedNumber from '../useAnimatedNumber';

const setReducedMotion = (matches) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches });
};

const renderCounter = (value) =>
  renderHook(({ target }) => useAnimatedNumber(target), { initialProps: { target: value } });

const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('useAnimatedNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    setReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.matchMedia;
  });

  it('shows the value as-is on first render', () => {
    const { result } = renderCounter(120);
    expect(result.current).toBe(120);
  });

  it('counts through the values in between and lands exactly on the new one', () => {
    const { result, rerender } = renderCounter(0);
    rerender({ target: 100 });

    advance(200);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    advance(600);
    expect(result.current).toBe(100);
  });

  it('counts down as well as up, for a penalty', () => {
    const { result, rerender } = renderCounter(100);
    rerender({ target: 40 });

    advance(200);
    expect(result.current).toBeLessThan(100);
    expect(result.current).toBeGreaterThan(40);

    advance(600);
    expect(result.current).toBe(40);
  });

  it('carries on from the number on screen if the value changes mid-count', () => {
    const { result, rerender } = renderCounter(0);
    rerender({ target: 100 });
    advance(200);
    const midway = result.current;

    rerender({ target: 50 });
    advance(20);
    // Heading down from wherever it had reached, not restarting from 0.
    expect(result.current).toBeLessThanOrEqual(midway);
    expect(result.current).toBeGreaterThanOrEqual(50);

    advance(800);
    expect(result.current).toBe(50);
  });

  it('jumps straight to the new value for anyone who prefers reduced motion', () => {
    setReducedMotion(true);
    const { result, rerender } = renderCounter(0);
    rerender({ target: 100 });
    expect(result.current).toBe(100);
  });
});
