import { useState, useEffect } from 'react';

const MISSION_PREFIX = {
  daily:            '◈ Daily',
  main:             '◈ Main Quest',
  urgent:           '⚡ Urgent',
  punishment:       '⚠ Punishment',
  hidden:           '✦ Hidden',
  system_generated: '◈ System',
};

const TYPE_LABEL = {
  daily_brief:  'Morning Brief',
  evening_eval: 'Evening Evaluation',
  punishment:   'System Penalty',
  chat_response:'System Response',
  alert:        'System Alert',
};

function TypewriterText({ text, speed = 18, onDone }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayed}</span>;
}

export default function SystemMessageBox({ log, animate = false, className = '' }) {
  const [missionsDone, setMissionsDone] = useState(false);

  if (!log) return null;

  const label = TYPE_LABEL[log.message_type] || 'System Message';
  const missions = log.missions_issued || log.missions || [];
  const isPunishment = log.message_type === 'punishment';

  return (
    <div
      className={`rpg-window ${className}`}
      style={isPunishment ? { borderColor: 'var(--accent-rust)', boxShadow: '0 3px 0 rgba(184,92,66,.3), 0 6px 16px rgba(184,92,66,.15)' } : {}}
    >
      {/* Header */}
      <div
        className="rpg-header text-xs"
        style={isPunishment ? { background: 'linear-gradient(180deg, var(--accent-rust) 0%, #8B2C1A 100%)' } : {}}
      >
        [SYSTEM] ▸ {label}
      </div>

      <div className="px-5 py-4 font-mono text-sm space-y-3" style={{ fontFamily: 'monospace, "Klee One", serif' }}>
        {/* System message */}
        <p className="text-ink leading-relaxed">
          {animate
            ? <TypewriterText text={log.content || log.system_message || ''} onDone={() => setMissionsDone(true)} />
            : (log.content || log.system_message || '')}
        </p>

        {/* Missions list */}
        {missions.length > 0 && (!animate || missionsDone) && (
          <div className="space-y-2 pt-1 border-t border-[var(--frame)]/30">
            {missions.map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="text-xs font-semibold flex-shrink-0 mt-0.5"
                  style={{ color: m.mission_type === 'punishment' ? 'var(--accent-rust)' : 'var(--accent-gold-deep)' }}
                >
                  {MISSION_PREFIX[m.mission_type] || '◈'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-xs font-semibold leading-snug">{m.title}</p>
                  {m.flavor_text && (
                    <p className="text-ink-mute text-xs italic mt-0.5">{m.flavor_text}</p>
                  )}
                </div>
                {m.reward && (
                  <span className="text-xs font-semibold flex-shrink-0 tabular-nums" style={{ color: 'var(--accent-gold-deep)' }}>
                    {m.reward}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Evaluation */}
        {log.evaluation && (
          <p className="text-xs text-ink-mute italic border-t border-[var(--frame)]/20 pt-2">
            [Evaluation] {log.evaluation}
          </p>
        )}
      </div>
    </div>
  );
}
