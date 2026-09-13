import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserProfileCard from '../UserProfileCard';

const context = vi.hoisted(() => ({ value: {} }));
vi.mock('../../context/appContextValue.js', () => ({ useAppContext: () => context.value }));

const player = { name: 'Elena', level: 10, streak: 3 };

describe('UserProfileCard', () => {
  beforeEach(() => {
    context.value = { activeTitle: null };
  });

  it("shows the portrait and title for the player's level", () => {
    render(<UserProfileCard user={player} />);
    expect(screen.getByAltText('Disciplined Warrior portrait'))
      .toHaveAttribute('src', '/avatars/avatar_stage_3.png');
    expect(screen.getByRole('heading', { name: 'Elena' })).toBeInTheDocument();
  });

  it('shows the current streak', () => {
    render(<UserProfileCard user={player} />);
    expect(screen.getByText('day streak').parentElement).toHaveTextContent('3day streak');
  });

  it('shows a best streak only once there is one', () => {
    const { rerender } = render(<UserProfileCard user={player} userStats={{ max_streak: 0 }} />);
    expect(screen.queryByText(/best streak/)).not.toBeInTheDocument();

    rerender(<UserProfileCard user={player} userStats={{ max_streak: 7 }} />);
    expect(screen.getByText(/best streak/)).toHaveTextContent('best streak — 7 days');
  });

  it('shows an equipped title', () => {
    context.value = { activeTitle: { display: 'Early Riser' } };
    render(<UserProfileCard user={player} />);
    expect(screen.getByText(/Early Riser/)).toBeInTheDocument();
  });

  it('falls back to a placeholder portrait if the image fails to load', () => {
    render(<UserProfileCard user={player} />);
    const portrait = screen.getByAltText('Disciplined Warrior portrait');
    fireEvent.error(portrait);
    expect(portrait.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });
});
