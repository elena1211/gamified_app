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

/**
 * Main Goal component displays the user's primary objective
 * Shows goal details, progress tracking, and creation date
 */
export default function MainGoal({ currentUser }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGoal = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiRequest(
        `${API_ENDPOINTS.goal}?user=${currentUser || "tester"}`,
      );
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
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
        <div className="animate-pulse">
          <div className="h-6 bg-white/30 rounded mb-2"></div>
          <div className="h-4 bg-white/20 rounded"></div>
        </div>
      </div>
    );
  }

  if (!goal) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-start gap-4">
        <div className="text-4xl">🎯</div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">Main Goal</h2>
          <h3 className="text-xl font-semibold mb-3">{goal.title}</h3>
          <p className="text-white/90 leading-relaxed">{goal.description}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <span>📅 Started:</span>
            <span>{new Date(goal.created_at).toLocaleDateString("en-GB")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
