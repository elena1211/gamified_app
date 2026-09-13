import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../AppContext';
import { useAppContext } from '../appContextValue';

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

// A completion applies a reward string; a failed request has to undo exactly
// that string. Both go through applyStatChanges, so inverting and re-applying
// must land back on the original value.
function StatChangeProbe({ change }) {
  const { attributeStats, applyStatChanges } = useAppContext();
  const invertSigns = (s) =>
    s.replace(/([+-])(\d+)/g, (_, sign, num) => `${sign === '+' ? '-' : '+'}${num}`);

  return (
    <div>
      <span data-testid="discipline">{attributeStats.discipline}</span>
      <span data-testid="intelligence">{attributeStats.intelligence}</span>
      <button onClick={() => applyStatChanges(change)}>apply</button>
      <button onClick={() => applyStatChanges(invertSigns(change))}>revert</button>
    </div>
  );
}

describe('applyStatChanges round-trip', () => {
  it('returns every attribute to its starting value when a reward is reverted', () => {
    render(
      <AppProvider>
        <StatChangeProbe change="+3 Discipline, +2 Intelligence" />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText('apply'));
    expect(screen.getByTestId('discipline').textContent).toBe('3');
    expect(screen.getByTestId('intelligence').textContent).toBe('2');

    fireEvent.click(screen.getByText('revert'));
    expect(screen.getByTestId('discipline').textContent).toBe('0');
    expect(screen.getByTestId('intelligence').textContent).toBe('0');
  });

  it('flips every sign, not just the leading one', () => {
    // A naive '+' -> '-' replacement would leave a negative term untouched and
    // apply it twice in the same direction.
    render(
      <AppProvider>
        <StatChangeProbe change="+6 Discipline, +4 Intelligence" />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText('apply'));
    fireEvent.click(screen.getByText('apply'));
    expect(screen.getByTestId('discipline').textContent).toBe('12');

    fireEvent.click(screen.getByText('revert'));
    expect(screen.getByTestId('discipline').textContent).toBe('6');
    expect(screen.getByTestId('intelligence').textContent).toBe('4');
  });
});
