import { useEffect, useState } from 'react';
import { Lock, Trophy } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';

// The whole collection, earned or not: one you can see the shape of is one
// you can aim at. Unearned entries say what earns them rather than hiding it.
export default function AchievementList() {
  const [achievements, setAchievements] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await apiRequest(API_ENDPOINTS.achievements);
        setAchievements(data.achievements);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, []);

  if (error) {
    return (
      <p className="text-sm text-ink-soft" role="alert">
        {error}
      </p>
    );
  }

  if (!achievements) {
    return (
      <p className="text-sm text-ink-mute animate-pulse" role="status">
        Reading your collection…
      </p>
    );
  }

  const earned = achievements.filter((a) => a.earned).length;

  return (
    <>
      <p className="text-sm text-ink-soft mb-3">
        {earned} of {achievements.length} earned
      </p>

      <ul className="space-y-2" role="list">
        {achievements.map((achievement) => (
          <li
            key={achievement.key}
            className="rpg-window-light flex items-start gap-3 px-4 py-3"
            style={{ opacity: achievement.earned ? 1 : 0.65 }}
          >
            {achievement.earned ? (
              <Trophy size={18} style={{ color: 'var(--accent-gold-deep)' }} aria-hidden />
            ) : (
              <Lock size={18} style={{ color: 'var(--ink-mute)' }} aria-hidden />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm text-ink">
                {achievement.name}
                {!achievement.earned && <span className="sr-only"> — not earned yet</span>}
              </p>
              <p className="text-xs text-ink-soft">{achievement.description}</p>
            </div>
            {achievement.earned_at && (
              <time
                dateTime={achievement.earned_at}
                className="text-[11px] text-ink-mute whitespace-nowrap"
              >
                {new Date(achievement.earned_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </time>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
