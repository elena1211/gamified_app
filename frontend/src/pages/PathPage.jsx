import { useCallback, useEffect, useState } from 'react';
import { Map } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import BottomNav from '../components/BottomNav.jsx';
import PathDraftEditor from '../components/PathDraftEditor.jsx';
import PathMilestone from '../components/PathMilestone.jsx';

export default function PathPage({ onNavigateToHome, onNavigateToTaskManager, onNavigateToSettings }) {
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

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
              <div className="rpg-header -mx-5 -mt-4 mb-3">Goal</div>
              <h2 className="font-display text-lg text-ink">{path.goal.title}</h2>
              {path.goal.description && (
                <p className="text-sm text-ink-soft mt-1">{path.goal.description}</p>
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
                />
              ))}
            </ol>

            <button onClick={() => setEditing(true)} className="rpg-btn-secondary w-full">
              Draft a new path
            </button>
            <p className="text-xs text-ink-mute text-center">
              A new path replaces this one, until it has progress behind it.
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
