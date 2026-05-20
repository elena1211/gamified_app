import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SystemAlert({ unreadCount = 0, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (unreadCount <= 0) return;
    const timer = setTimeout(() => setVisible(true), 30000); // 30s after mount
    return () => clearTimeout(timer);
  }, [unreadCount]);

  if (!visible || unreadCount <= 0) return null;

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998] max-w-xs w-full px-4"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="rpg-window px-4 py-3 flex items-center gap-3 cursor-pointer"
        style={{ borderColor: 'var(--accent-gold)', boxShadow: '0 3px 0 rgba(212,160,76,.4), 0 8px 20px rgba(61,40,23,.2)' }}
        onClick={() => { navigate('/system'); dismiss(); }}
      >
        <span className="text-xl flex-shrink-0">[!]</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink uppercase tracking-wider">System</p>
          <p className="text-xs text-ink-soft">
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''} — tap to view
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="text-ink-mute text-sm flex-shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
