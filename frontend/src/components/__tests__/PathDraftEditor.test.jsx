import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PathDraftEditor from '../PathDraftEditor';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../config/api.js', () => ({
  apiRequest,
  API_ENDPOINTS: { goalPath: '/path/', pathProposal: '/path/proposal/' },
}));

const DRAFT = {
  goal: { title: 'First software engineer job', description: 'In London' },
  milestones: [
    { title: 'Programming fundamentals', description: 'The basics.', completion_type: 'cumulative', target_count: 40 },
    { title: 'Emergency fund', completion_type: 'measurable', target_value: '1500.50', target_direction: 'at_least', unit: 'GBP' },
    { title: 'First interview', completion_type: 'outcome' },
  ],
  daily_quests: [{ title: 'Solve one algorithm problem', attribute: 'intelligence', milestone: 1 }],
};

const renderEditor = (props = {}) => {
  const onConfirmed = vi.fn();
  render(<PathDraftEditor onConfirmed={onConfirmed} {...props} />);
  return onConfirmed;
};

const askForDraft = async (draft = DRAFT) => {
  fireEvent.change(screen.getByLabelText('What do you want to reach?'), {
    target: { value: 'First software engineer job' },
  });
  apiRequest.mockResolvedValueOnce({ data: { draft } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask the System for a path' }));
  await screen.findByLabelText('Goal');
};

const confirmBody = () => JSON.parse(apiRequest.mock.calls.at(-1)[1].body);

describe('PathDraftEditor', () => {
  beforeEach(() => apiRequest.mockReset());

  it('asks the System with the goal the user typed', async () => {
    renderEditor();
    await askForDraft();

    expect(apiRequest).toHaveBeenCalledWith('/path/proposal/', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toEqual({
      goal_title: 'First software engineer job',
      goal_description: '',
    });
    expect(screen.getByLabelText('Title', { selector: '#milestone-title-0' })).toHaveValue('Programming fundamentals');
  });

  it('cannot ask for a path without a goal', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Ask the System for a path' })).toBeDisabled();
  });

  it('offers empty milestones, never a sample path, when the System is unavailable', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('What do you want to reach?'), { target: { value: 'Run a marathon' } });
    const unavailable = Object.assign(new Error("The System couldn't draft a path right now."), { status: 503 });
    apiRequest.mockRejectedValueOnce(unavailable);

    fireEvent.click(screen.getByRole('button', { name: 'Ask the System for a path' }));

    // The System's own reason, not a rewritten one: the backend message
    // already tells the user what to do next.
    expect(await screen.findByRole('status')).toHaveTextContent(
      "The System couldn't draft a path right now.",
    );
    expect(screen.getByLabelText('Title', { selector: '#milestone-title-0' })).toHaveValue('');
    expect(screen.getAllByText(/^Milestone \d$/)).toHaveLength(3);
  });

  it('keeps a rejected goal on the first step with the reason', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText('What do you want to reach?'), { target: { value: 'x'.repeat(3) } });
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('goal title is empty'), { status: 400 }));

    fireEvent.click(screen.getByRole('button', { name: 'Ask the System for a path' }));

    expect(await screen.findByText('goal title is empty')).toBeInTheDocument();
    expect(screen.queryByLabelText('Goal')).not.toBeInTheDocument();
  });

  it('lets the user write a path without asking the System at all', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Write it myself' }));

    expect(screen.getAllByText(/^Milestone \d$/)).toHaveLength(3);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('sends only the fields the chosen type uses', async () => {
    renderEditor();
    await askForDraft();

    // The first milestone was cumulative; making it measurable must not send
    // the old target_count along with the new target.
    fireEvent.change(screen.getByLabelText('How it counts as reached', { selector: '#milestone-type-0' }), {
      target: { value: 'measurable' },
    });
    fireEvent.change(screen.getByLabelText('Number', { selector: '#milestone-value-0' }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Unit', { selector: '#milestone-unit-0' }), {
      target: { value: 'km' },
    });
    apiRequest.mockResolvedValueOnce({ data: { path: { milestones: [] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this path' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    expect(confirmBody().milestones[0]).toEqual({
      title: 'Programming fundamentals',
      description: 'The basics.',
      completion_type: 'measurable',
      target_value: '10',
      target_direction: 'at_least',
      unit: 'km',
    });
  });

  it('keeps a quest with the milestone it belongs to when that milestone moves', async () => {
    renderEditor();
    await askForDraft();

    fireEvent.click(screen.getByRole('button', { name: 'Move milestone 1 later' }));
    apiRequest.mockResolvedValueOnce({ data: { path: { milestones: [] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this path' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    const body = confirmBody();
    expect(body.milestones.map((m) => m.title)).toEqual([
      'Emergency fund', 'Programming fundamentals', 'First interview',
    ]);
    expect(body.daily_quests).toEqual([
      { title: 'Solve one algorithm problem', attribute: 'intelligence', milestone: 2 },
    ]);
  });

  it('drops a removed milestone and the quests that pointed at it', async () => {
    renderEditor();
    await askForDraft({ ...DRAFT, milestones: [...DRAFT.milestones, { title: 'Offer', completion_type: 'outcome' }] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove milestone 1' }));
    apiRequest.mockResolvedValueOnce({ data: { path: { milestones: [] } } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this path' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    const body = confirmBody();
    expect(body.milestones).toHaveLength(3);
    expect(body.daily_quests).toEqual([]);
  });

  it('will not drop below three milestones or add above five', async () => {
    renderEditor();
    await askForDraft();

    expect(screen.getByRole('button', { name: 'Remove milestone 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add a milestone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a milestone' }));
    expect(screen.getAllByText(/^Milestone \d$/)).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Add a milestone' })).not.toBeInTheDocument();
  });

  it('stops at two daily quests for one milestone', async () => {
    renderEditor();
    await askForDraft();

    const addQuest = () => screen.getAllByRole('button', { name: 'Add a daily quest' })[0];
    fireEvent.click(addQuest());
    // Milestone 1 now has the drafted quest plus this one.
    expect(screen.getAllByRole('button', { name: 'Add a daily quest' })).toHaveLength(2);
  });

  it('shows the reason a path was refused and stays on the draft', async () => {
    renderEditor();
    await askForDraft();
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('milestone 1 title is empty'), { status: 400 }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm this path' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('milestone 1 title is empty');
    expect(screen.getByLabelText('Goal')).toBeInTheDocument();
  });

  it('confirms once however often the button is pressed', async () => {
    // The API layer retries a lost response, and a second confirm would
    // replace the path the first one just created.
    const onConfirmed = renderEditor();
    await askForDraft();
    let settle;
    apiRequest.mockReturnValueOnce(new Promise((resolve) => { settle = resolve; }));

    const confirm = screen.getByRole('button', { name: 'Confirm this path' });
    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: 'Setting your path…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Setting your path…' }));

    settle({ data: { path: { milestones: [] } } });
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});
