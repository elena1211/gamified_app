import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SystemAlert from '../SystemAlert';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const waitOutTheDelay = () => act(() => { vi.advanceTimersByTime(30000); });

describe('SystemAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigate.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('waits the full 30 seconds before interrupting the player', () => {
    render(<SystemAlert unreadCount={2} />);
    // Checked just short of the delay, not only after it, so shortening the
    // delay fails here too.
    act(() => { vi.advanceTimersByTime(29999); });
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByText(/2 unread messages/)).toBeInTheDocument();
  });

  it('uses the singular for one message', () => {
    render(<SystemAlert unreadCount={1} />);
    waitOutTheDelay();
    expect(screen.getByText(/1 unread message —/)).toBeInTheDocument();
  });

  it('never appears with nothing unread', () => {
    const { container } = render(<SystemAlert unreadCount={0} />);
    act(() => { vi.advanceTimersByTime(120000); });
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the System page when tapped', () => {
    const onDismiss = vi.fn();
    render(<SystemAlert unreadCount={2} onDismiss={onDismiss} />);
    waitOutTheDelay();
    fireEvent.click(screen.getByText(/unread messages/));
    expect(navigate).toHaveBeenCalledWith('/system');
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument();
  });

  it('can be dismissed without leaving the page', () => {
    const onDismiss = vi.fn();
    render(<SystemAlert unreadCount={2} onDismiss={onDismiss} />);
    waitOutTheDelay();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(navigate).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});
