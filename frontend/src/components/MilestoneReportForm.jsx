import { useState } from 'react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';

// Reporting the active milestone: what happened, for a milestone reached when
// it happens, or a new reading for one reached by a number. A milestone
// reached by repeating a quest has nothing to report — its quests move it.
export default function MilestoneReportForm({ milestone, onReported }) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isMeasurable = milestone.completion_type === 'measurable';
  const noteId = `report-note-${milestone.id}`;
  const valueId = `report-value-${milestone.id}`;

  const send = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const { data } = await apiRequest(API_ENDPOINTS.milestoneReport(milestone.id), {
        method: 'POST',
        body: JSON.stringify(
          isMeasurable ? { value: value.trim(), note: note.trim() } : { note: note.trim() },
        ),
      });
      setValue('');
      setNote('');
      onReported(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--frame)' }}>
      {isMeasurable ? (
        <>
          <label htmlFor={valueId} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
            Where are you now{milestone.unit ? ` (${milestone.unit})` : ''}?
          </label>
          <input
            id={valueId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="rpg-input w-full mb-2"
          />
          <label htmlFor={noteId} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
            A note (optional)
          </label>
        </>
      ) : (
        <label htmlFor={noteId} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
          Reached it? Say what happened
        </label>
      )}

      <input
        id={noteId}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        autoComplete="off"
        className="rpg-input w-full mb-2"
      />

      {error && (
        <p className="text-sm mb-2" style={{ color: 'var(--accent-rust)' }} role="alert">
          {error}
        </p>
      )}

      <button onClick={send} disabled={saving} className="rpg-btn-gold w-full">
        {saving ? 'Reporting…' : isMeasurable ? 'Report this reading' : 'Report it'}
      </button>
    </div>
  );
}
