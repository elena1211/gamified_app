import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskList from '../TaskList';

const buildTask = (overrides = {}) => ({
  id: 1,
  title: 'Meditate',
  tip: '10 minutes of mindfulness',
  reward: '+4 Energy, +6 Discipline',
  completed: false,
  ...overrides,
});

describe('TaskList', () => {
  it('says which milestone a quest serves, and says nothing for a task off the path', () => {
    render(
      <TaskList
        tasks={[
          buildTask({ id: 1, title: 'Solve one algorithm problem', milestone: { id: 4, position: 2, title: 'Emergency fund' } }),
          buildTask({ id: 2, title: 'Water the plants' }),
        ]}
        onTaskComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('Milestone 2 · Emergency fund')).toBeInTheDocument();
    expect(screen.getAllByText(/^Milestone /)).toHaveLength(1);
  });

  it('completes a task on a single tap, with no confirmation dialog', async () => {
    const onTaskComplete = vi.fn().mockResolvedValue(undefined);
    render(<TaskList tasks={[buildTask()]} onTaskComplete={onTaskComplete} />);

    fireEvent.click(screen.getByText('Meditate'));

    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    expect(onTaskComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    // This is a checklist, not a confirmation flow — no dialog should appear.
    expect(screen.queryByText(/complete quest/i)).not.toBeInTheDocument();
  });

  it('un-completes a task on a single tap too', () => {
    const onTaskComplete = vi.fn().mockResolvedValue(undefined);
    render(<TaskList tasks={[buildTask({ completed: true })]} onTaskComplete={onTaskComplete} />);

    fireEvent.click(screen.getByText('Meditate'));

    expect(onTaskComplete).toHaveBeenCalledTimes(1);
  });

  it('ignores a second tap on the same task while the first is still in flight', async () => {
    let resolveFirst;
    const onTaskComplete = vi.fn(
      () => new Promise((resolve) => { resolveFirst = resolve; }),
    );
    render(<TaskList tasks={[buildTask()]} onTaskComplete={onTaskComplete} />);

    const button = screen.getByText('Meditate');
    fireEvent.click(button);
    fireEvent.click(button); // rapid double-tap before the first call resolves

    expect(onTaskComplete).toHaveBeenCalledTimes(1);
    resolveFirst();
    await waitFor(() => {});
  });

  it('shows an empty-state message when there are no tasks', () => {
    render(<TaskList tasks={[]} onTaskComplete={vi.fn()} />);
    expect(screen.getByText(/no tasks today/i)).toBeInTheDocument();
  });
});
