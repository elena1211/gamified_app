import { useEffect, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { isPathQuest } from '../utils/pathFormat.js';
import MilestoneProgress from './MilestoneProgress.jsx';

// The step being worked on, how far along it is, and how much of the day's
// plan is done — the question "what now?", answered before anything else on
// the screen.
export default function TodaysFocus({ tasks }) {
  // 'loading' until the path arrives: starting at "no path" would flash the
  // invitation at someone who has one.
  const [state, setState] = useState('loading');
  const [path, setPath] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await apiRequest(API_ENDPOINTS.goalPath);
        setPath(data.path);
        setState(data.path ? 'path' : 'none');
      } catch {
        // Show nothing rather than inviting someone who has a path to make
        // another one.
        setState('failed');
      }
    };
    load();
  }, []);

  if (state === 'loading' || state === 'failed') return null;

  const quests = tasks.filter(isPathQuest);
  const done = quests.filter((task) => task.completed).length;
  const active = path?.milestones?.find((milestone) => milestone.status === 'active');

  return (
    <div className="rpg-window px-5 py-4">
      <h2 className="rpg-header -mx-5 -mt-4 mb-3 flex items-center gap-2">
        <MapIcon size={14} aria-hidden />
        Today
      </h2>

      {state === 'none' && (
        <>
          <p className="text-sm text-ink-soft mb-3">
            Set a goal and the System will break it into milestones and daily quests.
          </p>
          <Link to="/path" className="rpg-btn-primary w-full block text-center">
            Create your path
          </Link>
        </>
      )}

      {path?.reached && (
        <>
          <p className="font-display text-base text-ink mb-1">You reached it</p>
          <p className="text-sm text-ink-soft mb-3">{path.goal.title}</p>
          <Link to="/path" className="rpg-btn-secondary w-full block text-center">
            Set your next goal
          </Link>
        </>
      )}

      {active && (
        <Link
          to="/path"
          className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-gold-deep)] hover:bg-[var(--paper)]/60"
        >
          <span className="block text-xs uppercase tracking-wider text-ink-soft">
            Milestone {active.position}
          </span>
          <span className="block font-display text-base text-ink">{active.title}</span>
          <MilestoneProgress milestone={active} colour="var(--frame)" />
        </Link>
      )}

      {/* A path with nothing active: every milestone is reached, but the goal
          itself hasn't been reported yet. */}
      {state === 'path' && !path?.reached && !active && (
        <Link to="/path" className="text-sm text-ink-soft underline">
          Every milestone is reached — report the goal
        </Link>
      )}

      {quests.length > 0 && (
        <p
          className="text-sm text-ink-soft mt-3 pt-3"
          style={{ borderTop: '1px dashed var(--frame)' }}
        >
          {done === quests.length
            ? `Today's path quests are done — ${done} of ${quests.length}.`
            : `${done} of ${quests.length} path quests done today.`}
        </p>
      )}
    </div>
  );
}
