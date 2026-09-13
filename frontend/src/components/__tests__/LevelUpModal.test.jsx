import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LevelUpModal from '../LevelUpModal';

describe('LevelUpModal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<LevelUpModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the old and new avatar when the level crosses a stage', () => {
    render(
      <LevelUpModal isOpen oldLevel={4} newLevel={5} oldStage={1} newStage={2} newExp={290} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Level 4 → Level 5')).toBeInTheDocument();
    expect(screen.getByAltText('Stage 1')).toHaveAttribute('src', '/avatars/avatar_stage_1.png');
    expect(screen.getByAltText('Stage 2')).toHaveAttribute('src', '/avatars/avatar_stage_2.png');
    expect(screen.getByText("You're making great progress!")).toBeInTheDocument();
  });

  it('shows one avatar and no evolution when the stage is unchanged', () => {
    render(
      <LevelUpModal isOpen oldLevel={5} newLevel={6} oldStage={2} newStage={2} newExp={380} onClose={vi.fn()} />,
    );
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.queryByText(/Evolved/)).not.toBeInTheDocument();
  });

  it('closes from Continue', () => {
    const onClose = vi.fn();
    render(
      <LevelUpModal isOpen oldLevel={5} newLevel={6} oldStage={2} newStage={2} newExp={380} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
