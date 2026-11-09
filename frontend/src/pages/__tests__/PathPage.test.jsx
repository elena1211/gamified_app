import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PathPage from '../PathPage';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: {
    goalPath: '/path/',
    pathProposal: '/path/proposal/',
    goalReport: '/path/report/',
    milestoneReport: (id) => `/milestones/${id}/report/`,
  },
}));
vi.mock('../../components/BottomNav.jsx', () => ({ default: () => <nav /> }));

const reached = (milestones) =>
  milestones.map((milestone) => ({ ...milestone, status: 'completed' }));

const PATH = {
  confirmed_at: '2026-09-20T10:00:00Z',
  reached: false,
  goal: { id: 1, title: 'First software engineer job', description: 'In London' },
  milestones: [
    {
      id: 1, position: 1, title: 'Programming fundamentals', description: 'Finish the basics.',
      status: 'completed', completion_type: 'cumulative', target_count: 40,
      progress: { completions: 40 }, outcome_note: null,
    },
    {
      id: 2, position: 2, title: 'Emergency fund', description: '',
      status: 'active', completion_type: 'measurable', target_value: '1500.50',
      target_direction: 'at_least', unit: 'GBP', progress: { latest_value: '750.25' },
      outcome_note: null,
    },
    {
      id: 3, position: 3, title: 'First interview', description: '',
      status: 'locked', completion_type: 'outcome', progress: null, outcome_note: null,
    },
  ],
};

describe('PathPage reporting', () => {
  beforeEach(() => apiRequest.mockReset());

  it('offers a report on the active milestone only', async () => {
    apiRequest.mockResolvedValue({ data: { path: PATH } });
    render(<PathPage />);
    await screen.findByText('First software engineer job');

    // Milestone 2 is the active one, and it is measurable.
    expect(screen.getByLabelText('Where are you now (GBP)?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reached it? Say what happened')).not.toBeInTheDocument();
  });

  it('shows the path the report came back with', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    render(<PathPage />);
    await screen.findByText('First software engineer job');

    fireEvent.change(screen.getByLabelText('Where are you now (GBP)?'), { target: { value: '2000' } });
    const moved = {
      ...PATH,
      milestones: [
        PATH.milestones[0],
        { ...PATH.milestones[1], status: 'completed', progress: { latest_value: '2000.00' } },
        { ...PATH.milestones[2], status: 'active' },
      ],
    };
    apiRequest.mockResolvedValueOnce({ data: { reached: true, path: moved } });
    fireEvent.click(screen.getByRole('button', { name: 'Report this reading' }));

    expect(await screen.findByText('2000.00 GBP reported')).toBeInTheDocument();
    expect(screen.getAllByText('Reached')).toHaveLength(2);
  });

  it('asks the user to report the goal once every milestone is reached', async () => {
    apiRequest.mockResolvedValueOnce({
      data: { path: { ...PATH, milestones: reached(PATH.milestones) } },
    });
    render(<PathPage />);

    const note = await screen.findByLabelText('Have you reached the goal itself? Say what happened');
    fireEvent.change(note, { target: { value: 'Signed the contract' } });
    apiRequest.mockResolvedValueOnce({
      data: {
        path: {
          ...PATH,
          reached: true,
          goal: { ...PATH.goal, outcome_note: 'Signed the contract' },
          milestones: reached(PATH.milestones),
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'I have reached it' }));

    expect(await screen.findByText('Goal reached')).toBeInTheDocument();
    expect(screen.getByText('“Signed the contract”')).toBeInTheDocument();
  });

  it('does not ask about the goal while a milestone is unreached', async () => {
    apiRequest.mockResolvedValue({ data: { path: PATH } });
    render(<PathPage />);
    await screen.findByText('First software engineer job');

    expect(
      screen.queryByLabelText('Have you reached the goal itself? Say what happened'),
    ).not.toBeInTheDocument();
  });

  it('keeps a reached path on screen and offers the next goal instead of a report', async () => {
    apiRequest.mockResolvedValue({
      data: {
        path: {
          ...PATH,
          reached: true,
          goal: { ...PATH.goal, outcome_note: 'Signed the contract' },
          milestones: reached(PATH.milestones),
        },
      },
    });
    render(<PathPage />);

    expect(await screen.findByRole('button', { name: 'Set your next goal' })).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Have you reached the goal itself? Say what happened'),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Where are you now (GBP)?')).not.toBeInTheDocument();
  });
});

describe('PathPage', () => {
  beforeEach(() => apiRequest.mockReset());

  it('shows the goal and every milestone with its status', async () => {
    apiRequest.mockResolvedValue({ data: { path: PATH } });
    render(<PathPage />);

    expect(await screen.findByText('First software engineer job')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Programming fundamentals' })).toBeInTheDocument();
    expect(screen.getByText('Reached')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('750.25 GBP reported')).toBeInTheDocument();
    expect(screen.getByText('At least 1500.50 GBP')).toBeInTheDocument();
  });

  it('invites a user with no path to create one', async () => {
    apiRequest.mockResolvedValue({ data: { path: null } });
    render(<PathPage />);

    expect(await screen.findByText('No path set')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create your path' }));

    expect(screen.getByLabelText('What do you want to reach?')).toBeInTheDocument();
  });

  it('offers to try again when the path cannot be read, and shows no empty state', async () => {
    // A cold start must not read as "you have no path" — that invites the
    // user to draft a replacement for a path that is actually there.
    apiRequest.mockRejectedValueOnce(new Error('Connection error: server asleep'));
    render(<PathPage />);

    expect(await screen.findByText('Connection error: server asleep')).toBeInTheDocument();
    expect(screen.queryByText('No path set')).not.toBeInTheDocument();

    apiRequest.mockResolvedValue({ data: { path: PATH } });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('First software engineer job')).toBeInTheDocument();
  });

  it('starts a new draft from the goal already set', async () => {
    apiRequest.mockResolvedValue({ data: { path: PATH } });
    render(<PathPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Draft a new path' }));

    expect(screen.getByLabelText('What do you want to reach?')).toHaveValue('First software engineer job');
  });

  it('shows the new path as soon as one is confirmed', async () => {
    apiRequest.mockResolvedValueOnce({ data: { path: null } });
    render(<PathPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create your path' }));

    fireEvent.change(screen.getByLabelText('What do you want to reach?'), {
      target: { value: 'Run a marathon' },
    });
    apiRequest.mockResolvedValueOnce({
      data: { draft: { goal: { title: 'Run a marathon', description: '' }, milestones: PATH.milestones, daily_quests: [] } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the System for a path' }));

    await screen.findByLabelText('Goal');
    apiRequest.mockResolvedValueOnce({ data: { path: PATH } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this path' }));

    expect(await screen.findByRole('heading', { name: 'Programming fundamentals' })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenLastCalledWith('/path/', expect.objectContaining({ method: 'PUT' })),
    );
  });
});
