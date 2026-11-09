import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DailyCheckIn from '../DailyCheckIn';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: { checkIn: '/check-in/' },
}));

const state = (changes = {}) => ({
  checked_in_today: false,
  checked_in_now: false,
  streak: 3,
  max_streak: 7,
  streak_at_risk: false,
  ...changes,
});

describe('DailyCheckIn', () => {
  beforeEach(() => apiRequest.mockReset());

  it('shows the streak and offers to mark today', async () => {
    apiRequest.mockResolvedValueOnce({ data: state() });
    render(<DailyCheckIn />);

    expect(await screen.findByText('3 days in a row')).toBeInTheDocument();
    expect(screen.getByText('Mark today to keep the streak going.')).toBeInTheDocument();
  });

  it('counts a single day in the singular', async () => {
    apiRequest.mockResolvedValueOnce({ data: state({ streak: 1 }) });
    render(<DailyCheckIn />);

    expect(await screen.findByText('1 day in a row')).toBeInTheDocument();
  });

  it('marks today and tells the page the new streak', async () => {
    const onCheckedIn = vi.fn();
    apiRequest.mockResolvedValueOnce({ data: state() });
    render(<DailyCheckIn onCheckedIn={onCheckedIn} />);
    await screen.findByText('3 days in a row');

    apiRequest.mockResolvedValueOnce({
      data: state({ checked_in_today: true, checked_in_now: true, streak: 4 }),
    });
    fireEvent.click(screen.getByRole('button', { name: "I'm here today" }));

    expect(await screen.findByText('4 days in a row')).toBeInTheDocument();
    expect(screen.getByText('Today is counted. See you tomorrow.')).toBeInTheDocument();
    expect(onCheckedIn).toHaveBeenCalledWith(expect.objectContaining({ streak: 4 }));
  });

  it('offers nothing to press once today is counted', async () => {
    apiRequest.mockResolvedValueOnce({ data: state({ checked_in_today: true }) });
    render(<DailyCheckIn />);

    await screen.findByText('3 days in a row');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('warns when yesterday was missed', async () => {
    apiRequest.mockResolvedValueOnce({ data: state({ streak_at_risk: true }) });
    render(<DailyCheckIn />);

    expect(
      await screen.findByText('You missed yesterday — turn up today and the streak holds.'),
    ).toBeInTheDocument();
  });

  it('marks today once however often the button is pressed', async () => {
    apiRequest.mockResolvedValueOnce({ data: state() });
    render(<DailyCheckIn />);
    await screen.findByText('3 days in a row');
    let settle;
    apiRequest.mockReturnValueOnce(new Promise((resolve) => { settle = resolve; }));

    fireEvent.click(screen.getByRole('button', { name: "I'm here today" }));
    expect(screen.getByRole('button', { name: 'Marking today…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Marking today…' }));

    settle({ data: state({ checked_in_today: true, streak: 4 }) });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
  });

  it('shows nothing rather than a wrong streak when it cannot be read', async () => {
    apiRequest.mockRejectedValueOnce(new Error('offline'));
    const { container } = render(<DailyCheckIn />);

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says what went wrong if marking today fails', async () => {
    apiRequest.mockResolvedValueOnce({ data: state() });
    render(<DailyCheckIn />);
    await screen.findByText('3 days in a row');
    apiRequest.mockRejectedValueOnce(new Error('Request was throttled.'));

    fireEvent.click(screen.getByRole('button', { name: "I'm here today" }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request was throttled.');
  });
});
