import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useAppContext } from '../AppContext';

// Minimal consumer to exercise getAttributePoints through the real context.
function AttributePointsProbe({ attribute, tasks }) {
  const { getAttributePoints, updateCompletedTasksState } = useAppContext();

  return (
    <button onClick={() => updateCompletedTasksState(tasks)}>
      total: <span data-testid="total">{getAttributePoints(attribute)}</span>
    </button>
  );
}

describe('getAttributePoints', () => {
  it('sums the halved reward actually granted, not the raw reward_point budget', () => {
    render(
      <AppProvider>
        <AttributePointsProbe
          attribute="discipline"
          tasks={[
            { attribute: 'discipline', reward_point: 6 },
            { attribute: 'discipline', reward_point: 5 },
            { attribute: 'energy', reward_point: 9 },
          ]}
        />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole('button'));

    // 6 // 2 + 5 // 2 = 3 + 2 = 5, not the raw 6 + 5 = 11
    expect(screen.getByTestId('total').textContent).toBe('5');
  });

  it('adds the difficulty bonus for discipline-attribute tasks with difficulty > 1', () => {
    // TaskCompleteView grants reward_point // 2 to a task's own attribute,
    // plus a "+difficulty-1" bonus to Discipline specifically whenever
    // difficulty > 1. When the task's own attribute IS discipline, both
    // land on the same total.
    render(
      <AppProvider>
        <AttributePointsProbe
          attribute="discipline"
          tasks={[
            { attribute: 'discipline', reward_point: 6, difficulty: 3 },
            { attribute: 'energy', reward_point: 9, difficulty: 3 },
          ]}
        />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole('button'));

    // discipline task: 6 // 2 + (3 - 1) = 3 + 2 = 5
    // energy task's difficulty bonus targets discipline too, but only
    // through its own reward string applied server-side -- getAttributePoints
    // only totals tasks whose own attribute matches the one queried, so it
    // isn't reflected here (no caller currently needs that cross-attribute case).
    expect(screen.getByTestId('total').textContent).toBe('5');
  });
});
