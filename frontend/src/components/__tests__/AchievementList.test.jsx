import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AchievementList from '../AchievementList';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: { achievements: '/achievements/' },
}));

const COLLECTION = [
  {
    key: 'first_steps',
    name: 'First Steps',
    description: 'Finished your first quest',
    earned: true,
    earned_at: '2026-11-02T09:30:00Z',
  },
  {
    key: 'unbroken',
    name: 'Unbroken',
    description: 'Turned up thirty days running',
    earned: false,
    earned_at: null,
  },
];

describe('AchievementList', () => {
  beforeEach(() => apiRequest.mockReset());

  it('lists what has been earned and what has not', async () => {
    apiRequest.mockResolvedValueOnce({ data: { achievements: COLLECTION } });
    render(<AchievementList />);

    expect(await screen.findByText('1 of 2 earned')).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('Turned up thirty days running')).toBeInTheDocument();
  });

  it('says what earns an achievement before it is earned', async () => {
    // Hiding the condition would make the collection impossible to aim at.
    apiRequest.mockResolvedValueOnce({ data: { achievements: COLLECTION } });
    render(<AchievementList />);

    const unearned = (await screen.findByText('Unbroken')).closest('li');
    expect(unearned).toHaveTextContent('Turned up thirty days running');
    expect(unearned).toHaveTextContent('not earned yet');
  });

  it('shows when an earned one was earned', async () => {
    apiRequest.mockResolvedValueOnce({ data: { achievements: COLLECTION } });
    render(<AchievementList />);

    const earned = (await screen.findByText('First Steps')).closest('li');
    expect(earned.querySelector('time')).toHaveAttribute('datetime', '2026-11-02T09:30:00Z');
  });

  it('says so when the collection cannot be read', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Connection error'));
    render(<AchievementList />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Connection error');
  });

  it('announces that it is loading', async () => {
    apiRequest.mockReturnValueOnce(new Promise(() => {}));
    render(<AchievementList />);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Reading your collection…'),
    );
  });
});
