import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS, apiRequest } from "../config/api.js";
import { debugLog } from "../utils/logger.js";

const FALLBACK_GOAL = {
  id: 1,
  title: "Become a Software Engineer",
  description:
    "Master programming skills, build projects, and land a position at a tech company",
  is_completed: false,
  created_at: "2024-01-01",
};

export default function MainGoal({ currentUser }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGoal = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiRequest(API_ENDPOINTS.goal);
      setGoal(data);
      debugLog("✅ Goal loaded:", data);
    } catch (err) {
      debugLog("⚠️ Goal API unavailable, using fallback:", err.message);
      setGoal(FALLBACK_GOAL);
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
