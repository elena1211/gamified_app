import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WelcomePage from '../WelcomePage';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: { guest: '/guest/', login: '/login/' },
}));

const renderPage = () => {
  const props = { onLoginSuccess: vi.fn(), onNavigateToRegister: vi.fn() };
  render(<WelcomePage {...props} />);
  return props;
};

const signInWith = (username, password) => {
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: username } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
};

describe('WelcomePage', () => {
  beforeEach(() => apiRequest.mockReset());

  it('sends a new player to registration', () => {
    const { onNavigateToRegister } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(onNavigateToRegister).toHaveBeenCalled();
  });

  it('starts a guest session with an id the server mints', async () => {
    apiRequest.mockResolvedValue({ data: { username: 'guest_3f9a', token: 'tok' } });
    const { onLoginSuccess } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith('guest_3f9a', 'tok'));
    // The client sends no id of its own choosing: the id is the credential.
    expect(apiRequest).toHaveBeenCalledWith('/guest/', { method: 'POST', body: '{}' });
  });

  it('tells the player when a guest session cannot start', async () => {
    apiRequest.mockRejectedValueOnce(new Error('HTTP error! status: 503'));
    const { onLoginSuccess } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByText('Failed to start guest session. Please try again.')).toBeInTheDocument();
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('rejects a blank sign-in without calling the server', () => {
    renderPage();
    signInWith('   ', '   ');
    expect(screen.getByText('All fields are required')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('signs a player in with their credentials', async () => {
    apiRequest.mockResolvedValue({ data: { username: 'elena', token: 'tok' } });
    const { onLoginSuccess } = renderPage();

    signInWith('elena', 'correct horse');

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith('elena', 'tok'));
    expect(apiRequest).toHaveBeenCalledWith('/login/', {
      method: 'POST',
      body: JSON.stringify({ username: 'elena', password: 'correct horse' }),
    });
  });

  it("shows the server's reason when sign-in is refused, and lets the player try again", async () => {
    apiRequest.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderPage();

    signInWith('elena', 'wrong');

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });
});
