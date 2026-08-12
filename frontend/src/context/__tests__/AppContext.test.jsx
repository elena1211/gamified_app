import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useAppContext } from '../AppContext';

// Minimal consumer to exercise getAttributePoints through the real context.
function AttributePointsProbe({ attribute }) {
  const { getAttributePoints, updateCompletedTasksState } = useAppContext();

  return (
    <button
      onClick={() =>
        updateCompletedTasksState([
          { attribute: 'discipline', reward_point: 6 },
          { attribute: 'discipline', reward_point: 5 },
          { attribute: 'energy', reward_point: 9 },
        ])
      }
    >
      total: <span data-testid="total">{getAttributePoints(attribute)}</span>
    </button>
  );
}

describe('getAttributePoints', () => {
  it('sums the halved reward actually granted, not the raw reward_point budget', () => {
    render(
      <AppProvider>
        <AttributePointsProbe attribute="discipline" />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole('button'));

    // 6 // 2 + 5 // 2 = 3 + 2 = 5, not the raw 6 + 5 = 11
    expect(screen.getByTestId('total').textContent).toBe('5');
  });
});
