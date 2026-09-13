import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MainGoal from '../MainGoal';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({ apiRequest, API_ENDPOINTS: { goal: '/goal/' } }));

const goal = { title: 'Learn Rust', description: 'Ship a CLI tool', created_at: '2025-03-03T10:00:00Z' };

describe('MainGoal', () => {
  beforeEach(() => apiRequest.mockReset());

  it("shows the player's goal once it loads", async () => {
    apiRequest.mockResolvedValue({ data: goal });
    render(<MainGoal currentUser="elena" />);
    expect(await screen.findByRole('heading', { name: 'Learn Rust' })).toBeInTheDocument();
    expect(screen.getByText('Ship a CLI tool')).toBeInTheDocument();
    expect(screen.getByText('Started 3 Mar 2025')).toBeInTheDocument();
  });

  it('shows nothing for a player without a goal', async () => {
    apiRequest.mockResolvedValue({ data: { goal: null } });
    const { container } = render(<MainGoal currentUser="elena" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('says so when the goal cannot load, rather than showing a stand-in, and retries', async () => {
    apiRequest
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockResolvedValueOnce({ data: goal });
    render(<MainGoal currentUser="elena" />);

    expect(await screen.findByText('Could not load your goal.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Learn Rust' })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});
