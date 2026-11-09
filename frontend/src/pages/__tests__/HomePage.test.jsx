import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HomePage from '../HomePage';

const apiRequest = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const context = vi.hoisted(() => ({ value: {} }));

vi.mock('../../config/api.js', () => ({
  apiRequest,
  getAuthHeaders: () => ({}),
  API_ENDPOINTS: {
    goalPath: '/path/',
    tasks: '/tasks/',
    userStats: '/user/stats/',
    systemMessages: '/system/messages/',
    systemDailyStatus: '/system/daily-status/',
    systemPunishmentCheck: '/system/punishment-check/',
    dynamicTaskComplete: '/tasks/complete-dynamic/',
    dynamicTaskUncomplete: '/tasks/uncomplete-dynamic/',
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../context/appContextValue', () => ({ useAppContext: () => context.value }));
vi.mock('../../components/BottomNav', () => ({ default: () => <nav /> }));
vi.mock('../../components/WeeklyTaskStats', () => ({ default: () => null }));
vi.mock('../../components/MainGoal', () => ({ default: () => null }));
vi.mock('../../hooks/useQuestScheduler', () => ({ useQuestScheduler: () => ({}) }));

const QUEST = {
  id: 1,
  title: 'Solve one algorithm problem',
  tip: '',
  reward: '+1 Intelligence',
  reward_point: 3,
  completed: false,
  difficulty: 1,
  attribute: 'intelligence',
  milestone: { id: 2, position: 1, title: 'Programming fundamentals' },
};

// Every endpoint HomePage reads on mount, so only the path answer varies.
const mockLoads = (path) => {
  apiRequest.mockImplementation((url) => {
    if (url === '/path/') return Promise.resolve({ data: { path } });
    if (url === '/tasks/') return Promise.resolve({ data: [QUEST] });
    return Promise.resolve({ data: {} });
  });
};

describe('HomePage and the Goal Path', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    navigate.mockReset();
    context.value = {
      currentUser: 'walker',
      attributeStats: {},
      applyStatChanges: vi.fn(),
      updateUserStats: vi.fn(),
      setActiveTitle: vi.fn(),
      setUnreadSystemMessages: vi.fn(),
      userStats: { level: 1, exp: 0, currentStreak: 0 },
    };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('invites a user with no path to create one', async () => {
    mockLoads(null);
    render(<HomePage currentUser="walker" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create your path' }));

    expect(navigate).toHaveBeenCalledWith('/path');
  });

  it('says nothing about creating a path to a user who has one', async () => {
    mockLoads({ goal: { title: 'First software engineer job' }, milestones: [] });
    render(<HomePage currentUser="walker" />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/path/'));
    expect(screen.queryByRole('button', { name: 'Create your path' })).not.toBeInTheDocument();
  });

  it('keeps quiet when the path cannot be read, rather than inviting over an existing path', async () => {
    apiRequest.mockImplementation((url) =>
      url === '/path/' ? Promise.reject(new Error('offline')) : Promise.resolve({ data: [] }),
    );
    render(<HomePage currentUser="walker" />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/path/'));
    expect(screen.queryByRole('button', { name: 'Create your path' })).not.toBeInTheDocument();
  });

  it('always shows the path quest, however many other tasks are drawn', async () => {
    // The server sends the active milestone's quests whatever else it draws,
    // and Home then cuts the list down to three.
    const filler = Array.from({ length: 6 }, (_, i) => ({
      ...QUEST, id: 10 + i, title: `Unrelated ${i}`, difficulty: (i % 3) + 1, milestone: null,
    }));
    apiRequest.mockImplementation((url) => {
      if (url === '/path/') return Promise.resolve({ data: { path: { goal: {}, milestones: [] } } });
      if (url === '/tasks/') return Promise.resolve({ data: [QUEST, ...filler] });
      return Promise.resolve({ data: {} });
    });
    render(<HomePage currentUser="walker" />);

    expect(await screen.findByText('Solve one algorithm problem')).toBeInTheDocument();
  });

  it('announces a milestone the finished quest reached', async () => {
    mockLoads({ goal: { title: 'g' }, milestones: [] });
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        streak: 1,
        milestone: { id: 2, title: 'Programming fundamentals', status: 'completed', just_reached: true },
        user_stats: { level: 1, exp: 10, level_up: false, old_level: 1 },
      }),
    });
    render(<HomePage currentUser="walker" />);

    fireEvent.click(await screen.findByText('Solve one algorithm problem'));

    expect(await screen.findByText(/Programming fundamentals is done/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stays quiet about a milestone that was already reached before this quest', async () => {
    // A second quest under a milestone already reached adds nothing, so the
    // server says just_reached is false and nothing is celebrated again.
    mockLoads({ goal: { title: 'g' }, milestones: [] });
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        streak: 1,
        milestone: { id: 2, title: 'Programming fundamentals', status: 'completed', just_reached: false },
        user_stats: { level: 1, exp: 10, level_up: false, old_level: 1 },
      }),
    });
    render(<HomePage currentUser="walker" />);

    fireEvent.click(await screen.findByText('Solve one algorithm problem'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText(/is done/)).not.toBeInTheDocument();
  });

  it('says nothing when the quest leaves its milestone unfinished', async () => {
    mockLoads({ goal: { title: 'g' }, milestones: [] });
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        streak: 1,
        milestone: { id: 2, title: 'Programming fundamentals', status: 'active', just_reached: false },
        user_stats: { level: 1, exp: 10, level_up: false, old_level: 1 },
      }),
    });
    render(<HomePage currentUser="walker" />);

    fireEvent.click(await screen.findByText('Solve one algorithm problem'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText(/is done/)).not.toBeInTheDocument();
  });
});
