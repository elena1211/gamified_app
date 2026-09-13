import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '../RegisterPage';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({ apiRequest, API_ENDPOINTS: { register: '/register/' } }));

const renderPage = () => {
  const props = { onRegisterSuccess: vi.fn(), onNavigateBack: vi.fn() };
  render(<RegisterPage {...props} />);
  return props;
};

const type = (placeholder, value) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

const fillAccount = ({ username = 'elena', password = 'longenough', confirm = password } = {}) => {
  type('Choose a username', username);
  type('At least 8 characters', password);
  type('Repeat your password', confirm);
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Begin Journey' }));

describe('RegisterPage — account details', () => {
  beforeEach(() => apiRequest.mockReset());

  it('refuses a blank username', () => {
    renderPage();
    fillAccount({ username: '   ' });
    expect(screen.getByText('All fields are required')).toBeInTheDocument();
  });

  it('refuses a password shorter than the minimum', () => {
    renderPage();
    // Seven characters: under Django's default minimum of 8, which the server enforces.
    fillAccount({ password: 'sevenCh' });
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
  });

  it('refuses passwords that do not match', () => {
    renderPage();
    fillAccount({ password: 'longenough', confirm: 'longenougher' });
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('moves on to choosing a goal once the details are valid', () => {
    renderPage();
    fillAccount();
    expect(screen.getByText(/Step 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Set Your Main Goal' })).toBeInTheDocument();
  });

  it("keeps the player's details when they go back a step", () => {
    renderPage();
    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.getByPlaceholderText('Choose a username')).toHaveValue('elena');
  });
});

describe('RegisterPage — goal', () => {
  beforeEach(() => apiRequest.mockReset());

  it('requires a goal to be chosen', () => {
    renderPage();
    fillAccount();
    submit();
    expect(screen.getByText('Please select a goal')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('requires a title for a custom goal', () => {
    renderPage();
    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: /Custom Goal/ }));
    type('Enter your goal title', '   ');
    submit();
    expect(screen.getByText('Goal title is required')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('registers with the suggested goal the player picked', async () => {
    apiRequest.mockResolvedValue({ data: { username: 'elena', token: 'tok' } });
    const { onRegisterSuccess } = renderPage();

    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: /Learn Data Science/ }));
    submit();

    await waitFor(() => expect(onRegisterSuccess).toHaveBeenCalledWith('elena', 'tok'));
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toMatchObject({
      username: 'elena',
      password: 'longenough',
      goal_title: 'Learn Data Science',
      goal_description: 'Develop skills in statistics, machine learning, and data analysis',
    });
  });

  it("shows the server's reason when registration is refused", async () => {
    apiRequest.mockRejectedValueOnce(new Error('Username already exists'));
    renderPage();

    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: /Learn Data Science/ }));
    submit();

    expect(await screen.findByText('Username already exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin Journey' })).toBeEnabled();
  });
});
