import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsPanel from '../StatsPanel';

const baseStats = {
  intelligence: 3,
  discipline: 6,
  energy: 4,
  social: 0,
  wellness: 10,
  stress: 0,
};

describe('StatsPanel', () => {
  it('renders each attribute value', () => {
    render(<StatsPanel stats={baseStats} />);
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Discipline')).toBeInTheDocument();
  });

  it('shows a floating delta for a stat that changed, and keeps an earlier delta visible when a second stat changes shortly after', () => {
    const { rerender } = render(<StatsPanel stats={baseStats} />);

    rerender(<StatsPanel stats={{ ...baseStats, discipline: 7 }} />);
    expect(screen.getByText('+1')).toBeInTheDocument();

    // A second, different stat changes before the first delta's timer clears.
    rerender(<StatsPanel stats={{ ...baseStats, discipline: 7, energy: 8 }} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('fills each gauge by its share of the maximum, with a sliver for any non-zero stat', () => {
    const { container } = render(<StatsPanel stats={{ ...baseStats, stress: 25 }} />);
    const fills = [...container.querySelectorAll('.stat-gauge-fill')].map((gauge) =>
      gauge.style.getPropertyValue('--fill'),
    );
    // Every small non-zero stat shows the same sliver rather than nothing,
    // social (0) stays empty, and stress is out of 100, not 1000.
    expect(fills).toEqual(['0.012', '0.012', '0.012', '0', '0.012', '0.25']);
  });

  it('colors a stress decrease as a good change, unlike every other attribute', () => {
    const stressed = { ...baseStats, stress: 10 };
    const { rerender } = render(<StatsPanel stats={stressed} />);
    rerender(<StatsPanel stats={{ ...stressed, stress: 7 }} />);

    const delta = screen.getByText('-3');
    expect(delta).toBeInTheDocument();
    expect(delta).toHaveClass('text-sage');
  });
});
