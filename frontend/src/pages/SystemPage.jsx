import { useState, useEffect, useRef } from 'react';
import { Cpu, Send } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { useAppContext } from '../context/AppContext.jsx';
import BottomNav from '../components/BottomNav.jsx';
import SystemMessageBox from '../components/SystemMessageBox.jsx';

export default function SystemPage({ onNavigateToHome, onNavigateToTaskManager, onNavigateToSettings }) {
  const { currentUser } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [newTitles, setNewTitles] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await apiRequest(API_ENDPOINTS.systemMessages);
        setMessages(data.reverse());
      } catch {
        // history unavailable; fall back to empty list
      } finally {
        setHistoryLoading(false);
      }
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendToSystem = async (contextType = 'user_input', customMessage = null) => {
    // Briefs/evals ignore the message, so don't send whatever is sitting in
    // the textarea — it could even fail the backend's length check.
    const msg = customMessage ?? (contextType === 'user_input' ? inputText.trim() : '');
    if (contextType === 'user_input' && !msg) return;
    setLoading(true);

    try {
      const { data } = await apiRequest(API_ENDPOINTS.systemChat, {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          context_type: contextType,
        }),
      });

      const newEntry = {
        id: Date.now(),
        message_type: contextType === 'morning_brief' ? 'daily_brief'
                    : contextType === 'evening_eval' ? 'evening_eval'
                    : 'chat_response',
        content: data.system_message,
        evaluation: data.evaluation,
        missions_issued: data.missions,
        created_at: new Date().toISOString(),
        was_read: true,
        isNew: true,
      };

      setMessages(prev => [...prev, newEntry]);
      // Clear the input only on success so a failed send keeps the draft
      if (contextType === 'user_input') setInputText('');

      if (data.titles_awarded?.length > 0) {
        setNewTitles(data.titles_awarded);
        setTimeout(() => setNewTitles([]), 6000);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        message_type: 'alert',
        content: `[SYSTEM ERROR] ${err.message}`,
        missions_issued: [],
        created_at: new Date().toISOString(),
        isNew: true,
        is_error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendToSystem('user_input');
    }
  };

  return (
    <div className="paper-bg min-h-screen pb-24 page-enter">
      {/* Header */}
      <div style={{ background: 'var(--paper-deep)', borderBottom: '2px solid var(--frame)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <Cpu className="w-5 h-5" style={{ color: 'var(--accent-gold-deep)' }} />
          <h1 className="font-display text-xl text-ink tracking-wide">System Interface</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Quick actions */}
        <div className="flex gap-2">
          <button
            onClick={() => sendToSystem('morning_brief')}
            disabled={loading}
            className="rpg-btn-gold flex-1 text-xs py-2"
          >
            ☀ Morning Brief
          </button>
          <button
            onClick={() => sendToSystem('evening_eval')}
            disabled={loading}
            className="rpg-btn-secondary flex-1 text-xs py-2"
          >
            🌙 Evening Eval
          </button>
        </div>

        {/* Title award notification */}
        {newTitles.length > 0 && (
          <div
            className="rpg-window px-4 py-3 text-center text-sm"
            style={{ borderColor: 'var(--accent-gold)', background: '#FFF9E6' }}
          >
            <p className="text-gold font-display">✦ Title Unlocked!</p>
            {newTitles.map(t => (
              <p key={t} className="text-ink-soft text-xs mt-1">{t.replace(/_/g, ' ')}</p>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="rpg-window px-5 py-4">
            <div className="rpg-header text-xs">[SYSTEM] ▸ Transmitting…</div>
            <p className="px-5 py-3 text-xs text-ink-mute font-mono animate-pulse">
              Processing host request...
            </p>
          </div>
        )}

        {/* Message history */}
        {historyLoading ? (
          <p className="text-center text-xs text-ink-mute py-4 animate-pulse">
            Loading system logs…
          </p>
        ) : messages.length === 0 && !loading ? (
          <div className="rpg-window text-center px-5 py-8">
            <div className="rpg-header">[SYSTEM] ▸ First Contact</div>
            <p className="py-5 text-sm text-ink-soft italic">
              No prior contact detected.<br />
              Request a Morning Brief or report your current situation.
            </p>
          </div>
        ) : (
          messages.map((log, i) => (
            <SystemMessageBox
              key={log.id ?? i}
              log={log}
              animate={log.isNew}
            />
          ))
        )}

        <div ref={bottomRef} />
      </div>

      {/* Chat input */}
      <div
        className="fixed bottom-16 left-0 right-0 z-20"
        style={{ background: 'var(--paper-deep)', borderTop: '2px solid var(--frame)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 items-end">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Report your current situation to the System…"
            rows={2}
            maxLength={1000}
            className="rpg-input flex-1 resize-none text-sm"
            disabled={loading}
          />
          <button
            onClick={() => sendToSystem('user_input')}
            disabled={loading || !inputText.trim()}
            className="rpg-btn-primary p-3 flex-shrink-0"
            style={{ padding: '10px 14px' }}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <BottomNav
        onHomeClick={onNavigateToHome}
        onTaskManagerClick={onNavigateToTaskManager}
        onSettingsClick={onNavigateToSettings}
        currentPage="system"
      />
    </div>
  );
}
