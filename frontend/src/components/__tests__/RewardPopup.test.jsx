import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RewardPopup from '../RewardPopup';

describe('RewardPopup', () => {
  it('renders nothing while hidden', () => {
    const { container } = render(<RewardPopup isVisible={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows what was earned and for which quest', () => {
    render(
      <RewardPopup isVisible onClose={vi.fn()} taskTitle="Stretch" rewardPoints={3} attribute="wellness" totalPoints={12} />,
    );
    expect(screen.getByText('"Stretch"')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('wellness')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('closes from Continue Journey', () => {
    const onClose = vi.fn();
    render(<RewardPopup isVisible onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue Journey' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('still renders for an attribute it has no icon for', () => {
    render(<RewardPopup isVisible onClose={vi.fn()} attribute="luck" rewardPoints={1} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
