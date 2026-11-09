import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MilestoneReportForm from '../MilestoneReportForm';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: { milestoneReport: (id) => `/milestones/${id}/report/` },
}));

const outcome = { id: 7, completion_type: 'outcome' };
const measurable = { id: 9, completion_type: 'measurable', unit: 'GBP' };

const sent = () => JSON.parse(apiRequest.mock.calls.at(-1)[1].body);

describe('MilestoneReportForm', () => {
  beforeEach(() => apiRequest.mockReset());

  it('reports what happened for an outcome milestone', async () => {
    const onReported = vi.fn();
    render(<MilestoneReportForm milestone={outcome} onReported={onReported} />);

    fireEvent.change(screen.getByLabelText('Reached it? Say what happened'), {
      target: { value: '  Offer accepted  ' },
    });
    apiRequest.mockResolvedValueOnce({ data: { reached: true, path: { milestones: [] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Report it' }));

    await waitFor(() => expect(onReported).toHaveBeenCalledWith({ reached: true, path: { milestones: [] } }));
    expect(apiRequest).toHaveBeenCalledWith('/milestones/7/report/', expect.objectContaining({ method: 'POST' }));
    expect(sent()).toEqual({ note: 'Offer accepted' });
  });

  it('reports a reading, with the unit in the label, for a measurable milestone', async () => {
    render(<MilestoneReportForm milestone={measurable} onReported={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Where are you now (GBP)?'), { target: { value: '750.25' } });
    fireEvent.change(screen.getByLabelText('A note (optional)'), { target: { value: 'Payday' } });
    apiRequest.mockResolvedValueOnce({ data: { reached: false, path: { milestones: [] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Report this reading' }));

    await waitFor(() => expect(sent()).toEqual({ value: '750.25', note: 'Payday' }));
  });

  it('shows the reason a report was refused and keeps what was typed', async () => {
    render(<MilestoneReportForm milestone={measurable} onReported={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Where are you now (GBP)?'), { target: { value: 'abc' } });
    apiRequest.mockRejectedValueOnce(new Error('value is not a number'));

    fireEvent.click(screen.getByRole('button', { name: 'Report this reading' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('value is not a number');
    expect(screen.getByLabelText('Where are you now (GBP)?')).toHaveValue('abc');
  });

  it('reports once however often the button is pressed', async () => {
    const onReported = vi.fn();
    render(<MilestoneReportForm milestone={outcome} onReported={onReported} />);
    fireEvent.change(screen.getByLabelText('Reached it? Say what happened'), { target: { value: 'Done' } });
    let settle;
    apiRequest.mockReturnValueOnce(new Promise((resolve) => { settle = resolve; }));

    fireEvent.click(screen.getByRole('button', { name: 'Report it' }));
    expect(screen.getByRole('button', { name: 'Reporting…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reporting…' }));

    settle({ data: { reached: true, path: { milestones: [] } } });
    await waitFor(() => expect(onReported).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
