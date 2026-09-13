import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

function Explodes() {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders its children when nothing goes wrong', () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a way out instead of a blank page when a child throws', () => {
    // React reports the caught error to the console; that is expected here.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Explodes /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
  });
});
