import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useQuestScheduler } from '../useQuestScheduler';

function Harness({ isIdle, onOffer, enabled = true }) {
  useQuestScheduler({
    initialDelayRange: [1000, 1000],
    repeatRange: [1000, 1000],
    isIdle,
    onOffer,
    enabled,
  });
  return null;
}

describe('useQuestScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('offers a quest after the initial delay, then on the repeat interval', () => {
    const onOffer = vi.fn();
    render(<Harness isIdle={() => true} onOffer={onOffer} />);

    expect(onOffer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onOffer).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onOffer).toHaveBeenCalledTimes(2);
  });

  it('stops the chain on unmount', () => {
    // The original bug: the recursive setTimeout returned its id to a caller
    // that discarded it, so only the first timer was ever cleared and the
    // chain kept firing — and setting state — for the life of the tab.
    const onOffer = vi.fn();
    const { unmount } = render(<Harness isIdle={() => true} onOffer={onOffer} />);

    vi.advanceTimersByTime(1000);
    expect(onOffer).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(10_000);
    expect(onOffer).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips an offer while a quest is already on screen, and keeps scheduling', () => {
    // isIdle is read at fire time, not captured at mount — this is what stops a
    // new quest replacing one the user is mid-countdown on.
    const onOffer = vi.fn();
    let idle = false;
    render(<Harness isIdle={() => idle} onOffer={onOffer} />);

    vi.advanceTimersByTime(1000);
    expect(onOffer).not.toHaveBeenCalled();

    idle = true;
    vi.advanceTimersByTime(1000);
    expect(onOffer).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing while disabled', () => {
    const onOffer = vi.fn();
    render(<Harness isIdle={() => true} onOffer={onOffer} enabled={false} />);

    vi.advanceTimersByTime(10_000);
    expect(onOffer).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
