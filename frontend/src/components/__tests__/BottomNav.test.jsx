import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomNav from '../BottomNav';

const navigate = vi.hoisted(() => vi.fn());
const context = vi.hoisted(() => ({ value: {} }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../context/appContextValue.js', () => ({ useAppContext: () => context.value }));

const systemButton = () => screen.getByRole('button', { name: /system/i });

describe('BottomNav', () => {
  beforeEach(() => {
    navigate.mockClear();
    context.value = { unreadSystemMessages: 0 };
  });

  it('shows no badge when nothing is unread', () => {
    render(<BottomNav />);
    expect(systemButton()).toHaveTextContent(/^System$/);
  });

  it('shows the unread count on the System tab', () => {
    context.value = { unreadSystemMessages: 3 };
    render(<BottomNav />);
    expect(systemButton()).toHaveTextContent('3System');
  });

  it('shows up to 9 in full and caps anything more at 9+ so it still fits', () => {
    // 9 and 10 are the two sides of the cap; a larger number alone would not
    // notice the cap moving by one.
    context.value = { unreadSystemMessages: 9 };
    const { rerender } = render(<BottomNav />);
    expect(systemButton()).toHaveTextContent(/^9System$/);

    context.value = { unreadSystemMessages: 10 };
    rerender(<BottomNav />);
    expect(systemButton()).toHaveTextContent(/^9\+System$/);
  });

  it('goes to the System page by default', () => {
    render(<BottomNav />);
    fireEvent.click(systemButton());
    expect(navigate).toHaveBeenCalledWith('/system');
  });

  it('lets a page handle the System tab itself', () => {
    const onSystemClick = vi.fn();
    render(<BottomNav onSystemClick={onSystemClick} />);
    fireEvent.click(systemButton());
    expect(onSystemClick).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('wires every other tab to its handler', () => {
    const handlers = { onHomeClick: vi.fn(), onTaskManagerClick: vi.fn(), onSettingsClick: vi.fn() };
    render(<BottomNav {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /tasks/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    Object.values(handlers).forEach((handler) => expect(handler).toHaveBeenCalledTimes(1));
  });
});
