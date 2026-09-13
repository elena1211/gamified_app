import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS, apiRequest } from "../config/api.js";
import { debugLog } from "../utils/logger.js";

export default function MainGoal({ currentUser }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGoal = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiRequest(API_ENDPOINTS.goal);
      // The API returns { goal: null } for a user who has no active goal.
      setGoal(data?.goal === null ? null : data);
      debugLog("✅ Goal loaded:", data);
    } catch (err) {
      // Showing a stand-in goal here would present someone else's aspiration
      // as the user's own, so failures say so instead.
      debugLog("⚠️ Goal request failed:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  if (loading) {
    return (
      <div className="rpg-window animate-pulse">
        <div className="rpg-header">Main Goal</div>
        <div className="p-5">
          <div className="h-5 bg-[var(--paper-shadow)] rounded w-2/3 mb-2" />
          <div className="h-3 bg-[var(--paper-shadow)] rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rpg-window">
        <div className="rpg-header">Main Goal</div>
        <div className="px-5 py-4">
          <p className="text-sm text-ink-soft mb-3">Could not load your goal.</p>
          <button onClick={fetchGoal} className="rpg-btn-secondary text-xs">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!goal) return null;

  return (
    <div className="rpg-window">
      <div className="rpg-header">Main Goal</div>
      <div className="px-5 py-4">
        <h3 className="font-display text-xl text-ink mb-2 tracking-wide">
          {goal.title}
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed">
          {goal.description}
        </p>
        <div className="paper-divider mt-4">
          <span>
            Started {new Date(goal.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
