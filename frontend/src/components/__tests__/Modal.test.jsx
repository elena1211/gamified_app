import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

describe('Modal', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<Modal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is announced as a dialog named and described by its content', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Delete task?" message="This cannot be undone." />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete task?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops listening for Escape once it closes', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal isOpen onClose={onClose} />);
    rerender(<Modal isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('focuses Cancel on a destructive dialog so a stray Enter cannot confirm it', () => {
    render(<Modal isOpen type="danger" onClose={vi.fn()} onConfirm={vi.fn()} confirmText="Delete" />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('focuses Confirm on an ordinary dialog', () => {
    render(<Modal isOpen onClose={vi.fn()} onConfirm={vi.fn()} confirmText="Save" />);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('offers a single button for a notification, which closes it', () => {
    const onClose = vi.fn();
    render(<Modal isOpen variant="notification" onClose={onClose} confirmText="OK" />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('spells out the penalty when a quest is missed', () => {
    render(
      <Modal
        isOpen
        type="game-penalty"
        title="Quest Expired"
        message="Time ran out."
        penalty="-5 Discipline"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('-5 Discipline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Understood' })).toBeInTheDocument();
  });
});
