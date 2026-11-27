import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TodaysFocus from '../TodaysFocus';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: { goalPath: '/path/' },
}));

const QUEST = (changes = {}) => ({
  id: 1,
  title: 'Run for 30 minutes',
  completed: false,
  milestone: { id: 2, position: 1, title: 'Run 20 times' },
  ...changes,
});

const PATH = {
  reached: false,
  goal: { id: 1, title: 'Run a half marathon', description: '' },
  milestones: [
    {
      id: 2, position: 1, title: 'Run 20 times', status: 'active',
      completion_type: 'cumulative', target_count: 20, progress: { completions: 8 },
    },
    { id: 3, position: 2, title: 'Finish a 10k', status: 'locked', completion_type: 'outcome' },
  ],
};

const renderFocus = (tasks = []) =>
  render(
    <MemoryRouter>
      <TodaysFocus tasks={tasks} />
    </MemoryRouter>,
  );

describe('TodaysFocus', () => {
  beforeEach(() => apiRequest.mockReset());

  it('leads with the step being worked on and how far along it is', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    renderFocus([QUEST()]);

    expect(await screen.findByText('Run 20 times')).toBeInTheDocument();
    expect(screen.getByText('Milestone 1')).toBeInTheDocument();
    expect(screen.getByText('20 quest completions')).toBeInTheDocument();
    expect(screen.getByText('8 of 20')).toBeInTheDocument();
  });

  it('counts how much of today is done', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    renderFocus([QUEST({ completed: true }), QUEST({ id: 2, title: 'Read', completed: false })]);

    expect(await screen.findByText('1 of 2 path quests done today.')).toBeInTheDocument();
  });

  it('says so when today is finished', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    renderFocus([QUEST({ completed: true })]);

    expect(await screen.findByText(/Today's path quests are done/)).toBeInTheDocument();
  });

  it("counts only the path's quests, not every task drawn", async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    renderFocus([QUEST(), { id: 9, title: 'Water the plants', completed: true, milestone: null }]);

    expect(await screen.findByText('0 of 1 path quests done today.')).toBeInTheDocument();
  });

  it('invites a user with no path to create one', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: null } });
    renderFocus();

    const invitation = await screen.findByRole('link', { name: 'Create your path' });
    expect(invitation).toHaveAttribute('href', '/path');
  });

  it('shows nothing while the path is still being read', async () => {
    // Starting at "no path" would flash the invitation at someone who has
    // one, and a screen reader could land on a button that then vanishes.
    apiRequest.mockReturnValueOnce(new Promise(() => {}));
    const { container } = renderFocus();

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('points at the goal report when every milestone is reached', async () => {
    apiRequest.mockResolvedValueOnce({
      data: {
        path: {
          ...PATH,
          milestones: PATH.milestones.map((m) => ({ ...m, status: 'completed' })),
        },
      },
    });
    renderFocus();

    expect(
      await screen.findByRole('link', { name: /report the goal/ }),
    ).toBeInTheDocument();
  });

  it('offers the next goal once one is reached', async () => {
    apiRequest.mockResolvedValueOnce({
      data: { path: { ...PATH, reached: true, milestones: [] } },
    });
    renderFocus();

    expect(await screen.findByText('You reached it')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set your next goal' })).toBeInTheDocument();
  });

  it('links the step to the path, so it opens like any other link', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    renderFocus([QUEST()]);

    const step = (await screen.findByText('Run 20 times')).closest('a');
    expect(step).toHaveAttribute('href', '/path');
  });

  it('shows nothing at all when the path cannot be read', async () => {
    // An invitation here would tell someone who has a path to make another.
    apiRequest.mockRejectedValueOnce(new Error('Connection error'));
    const { container } = renderFocus();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
