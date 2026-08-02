import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message = 'Are you sure you want to proceed?',
  confirmText,
  cancelText,
  type = 'warning',
  variant = 'confirmation',
  showCloseButton = true,
  penalty = null,
}) {
  const confirmBtnRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const isDanger = type === 'danger';

  // Native window.confirm() gave focus handling and Escape-to-close for
  // free; this custom dialog needs to do it itself so keyboard users land
  // somewhere sensible instead of on whatever the trigger button was.
  // Destructive dialogs focus Cancel, not Confirm — an accidental Enter
  // right after open shouldn't be able to fire a delete.
  useEffect(() => {
    if (!isOpen) return;
    (isDanger ? cancelBtnRef : confirmBtnRef).current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isDanger]);

  if (!isOpen) return null;

  const defaultTitle       = title       || 'Confirm';
  const defaultConfirmText = confirmText || 'Confirm';
  const defaultCancelText  = cancelText  || 'Cancel';

  const isGamePenalty  = type === 'game-penalty';
  const isNotification = variant === 'notification';
  const isQuestDismissed = defaultTitle.includes('Dismissed');

  const getIcon = () => {
    if (isGamePenalty) return <div className="text-5xl mb-2">{isQuestDismissed ? '😰' : '⏰'}</div>;
    if (type === 'danger')  return <div className="text-4xl mb-3">✗</div>;
    if (type === 'success') return <div className="text-4xl mb-3">✓</div>;
    return <div className="text-4xl mb-3">⚠</div>;
  };

  const confirmBtnClass = (() => {
    if (isGamePenalty) return 'rpg-btn-secondary';
    if (type === 'danger')  return 'rpg-btn-primary';   // rust/rose = "destructive" colour
    if (type === 'success') return 'rpg-btn-sage';
    return 'rpg-btn-gold';
  })();

  return (
    <div
      className="backdrop-enter fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4"
      style={{ zIndex: isGamePenalty ? 9999 : 10001 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-message"
    >
      <div className="rpg-window modal-enter max-w-sm w-full">
        {showCloseButton && (
          <div className="flex justify-end px-4 pt-3">
            <button
              onClick={onClose}
              className="text-ink-mute hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="px-6 pb-6 pt-4 text-center">
          {getIcon()}

          <h3
            id="modal-title"
            className="font-display text-lg mb-3"
            style={{ color: isGamePenalty ? 'var(--accent-rust)' : 'var(--ink)' }}
          >
            {defaultTitle}
          </h3>

          {isGamePenalty && penalty ? (
            <>
              <div
                className="px-4 py-3 rounded-sm mb-4 text-sm"
                style={{ background: 'var(--paper-deep)', border: '2px solid var(--accent-rust)' }}
              >
                <p id="modal-message" className="text-ink font-medium mb-1">{message}</p>
                <p className="text-ink-soft">
                  <span className="font-semibold">Penalty:</span> {penalty}
                </p>
              </div>
              <p className="text-xs text-ink-mute mb-5">
                {isQuestDismissed ? 'Be brave next time!' : 'Act faster next time!'}
              </p>
            </>
          ) : (
            <p id="modal-message" className="text-sm text-ink-soft mb-5">{message}</p>
          )}

          <div className={`flex ${isNotification ? 'justify-center' : 'gap-3'}`}>
            {!isNotification && (
              <button ref={cancelBtnRef} onClick={onClose} className="rpg-btn-secondary flex-1">
                {defaultCancelText}
              </button>
            )}
            <button
              ref={confirmBtnRef}
              onClick={onConfirm || onClose}
              className={`${confirmBtnClass} ${isNotification ? 'w-full' : 'flex-1'}`}
            >
              {isGamePenalty ? 'Understood' : defaultConfirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
