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
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  // The Today card links to the path; this renders it as the anchor it is.
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}));
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

// The endpoints HomePage reads on mount. The Today card reads the path
// itself, so these tests only need the task list to answer.
const mockLoads = (path) => {
  apiRequest.mockImplementation((url) => {
    if (url === '/path/') return Promise.resolve({ data: { path } });
    if (url === '/tasks/') return Promise.resolve({ data: [QUEST] });
    return Promise.resolve({ data: {} });
  });
};

describe('HomePage quest feedback', () => {
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

  it('says what a completed quest earned', async () => {
    mockLoads({ goal: { title: 'g' }, milestones: [] });
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        streak: 1,
        achievements_earned: ['first_steps'],
        milestone: null,
        user_stats: { level: 1, exp: 10, level_up: false, old_level: 1 },
      }),
    });
    render(<HomePage currentUser="walker" />);

    fireEvent.click(await screen.findByText('Solve one algorithm problem'));

    expect(await screen.findByText(/First Steps/)).toBeInTheDocument();
  });

  it('says nothing about achievements when none were earned', async () => {
    mockLoads({ goal: { title: 'g' }, milestones: [] });
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        streak: 1,
        achievements_earned: [],
        milestone: null,
        user_stats: { level: 1, exp: 10, level_up: false, old_level: 1 },
      }),
    });
    render(<HomePage currentUser="walker" />);

    fireEvent.click(await screen.findByText('Solve one algorithm problem'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Achievement earned')).not.toBeInTheDocument();
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
