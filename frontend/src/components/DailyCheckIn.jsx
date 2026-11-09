import { useCallback, useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';

// Turning up, kept apart from the day's quests: this is only the user coming
// back. Finishing a quest counts as turning up too, so the button is already
// done for anyone who did the work first.
export default function DailyCheckIn({ onCheckedIn }) {
  const [state, setState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await apiRequest(API_ENDPOINTS.checkIn);
      setState(data);
    } catch {
      // Nothing to show rather than a wrong streak.
      setState(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const { data } = await apiRequest(API_ENDPOINTS.checkIn, { method: 'POST' });
      setState(data);
      onCheckedIn?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!state) return null;

  const { checked_in_today: checkedIn, streak, streak_at_risk: atRisk } = state;

  return (
    <div className="rpg-window px-5 py-4">
      <div className="rpg-header -mx-5 -mt-4 mb-3">Daily check-in</div>

      <div className="flex items-center gap-3">
        <Flame
          size={28}
          aria-hidden
          style={{ color: streak > 0 ? 'var(--accent-rust)' : 'var(--ink-mute)' }}
        />
        <div className="flex-1">
          <p className="font-display text-lg text-ink">
            {streak} {streak === 1 ? 'day' : 'days'} in a row
          </p>
          <p className="text-xs text-ink-soft">
            {checkedIn
              ? 'Today is counted. See you tomorrow.'
              : atRisk
                ? 'You missed yesterday — turn up today and the streak holds.'
                : 'Mark today to keep the streak going.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: 'var(--accent-rust)' }} role="alert">
          {error}
        </p>
      )}

      {!checkedIn && (
        <button onClick={checkIn} disabled={saving} className="rpg-btn-gold w-full mt-3">
          {saving ? 'Marking today…' : "I'm here today"}
        </button>
      )}
    </div>
  );
}
