import { useCallback, useEffect, useState } from 'react';
import { Map, Trophy } from 'lucide-react';
import { readable } from '../utils/pathFormat.js';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import BottomNav from '../components/BottomNav.jsx';
import PathDraftEditor from '../components/PathDraftEditor.jsx';
import PathMilestone from '../components/PathMilestone.jsx';

// The last thing on a path is the goal itself. The System can see every
// milestone is reached, but saying the goal is reached belongs to the user.
function GoalReportForm({ onReported }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const { data } = await apiRequest(API_ENDPOINTS.goalReport, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      });
      onReported(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rpg-window px-5 py-4">
      <h2 className="rpg-header -mx-5 -mt-4 mb-3">Every milestone reached</h2>
      <label htmlFor="goal-report-note" className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
        Have you reached the goal itself? Say what happened
      </label>
      <input
        id="goal-report-note"
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
        {saving ? 'Reporting…' : 'I have reached it'}
      </button>
    </div>
  );
}

export default function PathPage({ onNavigateToHome, onNavigateToTaskManager, onNavigateToSettings }) {
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [earned, setEarned] = useState([]);

  const loadPath = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiRequest(API_ENDPOINTS.goalPath);
      setPath(data.path);
    } catch (err) {
      // No sample path while the server is unreachable: an empty state here
      // would read as "you have no path" and invite the user to replace one.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  const onConfirmed = (confirmed) => {
    setPath(confirmed);
    setEditing(false);
  };

  const everyMilestoneReached =
    path && !path.reached && path.milestones.every((milestone) => milestone.status === 'completed');

  return (
    <div className="paper-bg min-h-screen pb-24 page-enter">
      <div style={{ background: 'var(--paper-deep)', borderBottom: '2px solid var(--frame)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <Map className="w-5 h-5" style={{ color: 'var(--accent-gold-deep)' }} />
          <h1 className="font-display text-xl text-ink tracking-wide">Your Path</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Announced, because the backend sleeps on the free tier: the first
            read can take half a minute before anything appears. */}
        {loading && (
          <p className="text-center text-xs text-ink-mute py-6 animate-pulse" role="status">
            Reading your path…
          </p>
        )}

        {!loading && error && (
          <div className="rpg-window px-5 py-6 text-center" role="alert">
            <p className="text-sm text-ink-soft mb-4">{error}</p>
            <button onClick={loadPath} className="rpg-btn-secondary">Try again</button>
          </div>
        )}

        {!loading && !error && editing && (
          <PathDraftEditor
            onConfirmed={onConfirmed}
            onCancel={() => setEditing(false)}
            currentGoal={path?.goal}
          />
        )}

        {!loading && !error && !editing && !path && (
          <div className="rpg-window px-5 py-8 text-center">
            <div className="rpg-header -mx-5 -mt-8 mb-5">No path set</div>
            <p className="text-sm text-ink-soft mb-5">
              Tell the System what you want to reach. It breaks the goal into milestones
              and daily quests, and you edit them before anything is set.
            </p>
            <button onClick={() => setEditing(true)} className="rpg-btn-primary">
              Create your path
            </button>
          </div>
        )}

        {!loading && !error && !editing && path && (
          <>
            <div className="rpg-window px-5 py-4">
              <div className="rpg-header -mx-5 -mt-4 mb-3">{path.reached ? 'Goal reached' : 'Goal'}</div>
              {path.reached && (
                <Trophy className="w-6 h-6 mb-2" style={{ color: 'var(--accent-gold-deep)' }} aria-hidden />
              )}
              <h2 className="font-display text-lg text-ink">{path.goal.title}</h2>
              {path.goal.description && (
                <p className="text-sm text-ink-soft mt-1">{path.goal.description}</p>
              )}
              {path.reached && path.goal.outcome_note && (
                <p className="text-sm text-ink-soft mt-2 italic">“{path.goal.outcome_note}”</p>
              )}
            </div>

            {/* role="list" because Safari drops list semantics from a list
                styled without markers, and the order is the path itself. */}
            <ol className="list-none" role="list">
              {path.milestones.map((milestone, index) => (
                <PathMilestone
                  key={milestone.id}
                  milestone={milestone}
                  isLast={index === path.milestones.length - 1}
                  onReported={path.reached ? undefined : (reported) => {
                    setPath(reported.path);
                    setEarned(reported.achievements_earned ?? []);
                  }}
                />
              ))}
            </ol>

            {earned.length > 0 && (
              <p className="rpg-window-light px-4 py-3 text-sm text-ink-soft" role="status">
                Achievement earned: {earned.map(readable).join(', ')}. See the rest in Settings.
              </p>
            )}

            {everyMilestoneReached && (
              <GoalReportForm
                onReported={(reported) => {
                  setPath(reported.path);
                  setEarned(reported.achievements_earned ?? []);
                }}
              />
            )}

            <button onClick={() => setEditing(true)} className="rpg-btn-secondary w-full">
              {path.reached ? 'Set your next goal' : 'Draft a new path'}
            </button>
            <p className="text-xs text-ink-mute text-center">
              {path.reached
                ? 'This path stays here until you set the next one.'
                : 'A new path replaces this one, until it has progress behind it.'}
            </p>
          </>
        )}
      </div>

      <BottomNav
        onHomeClick={onNavigateToHome}
        onTaskManagerClick={onNavigateToTaskManager}
        onSettingsClick={onNavigateToSettings}
        currentPage="path"
      />
    </div>
  );
}
