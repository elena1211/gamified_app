import { useState, useEffect } from "react";
import { API_ENDPOINTS, apiRequest } from "../config/api.js";
import { debugLog } from "../utils/logger";

export default function WeeklyTaskStats({ currentUser, refreshTrigger }) {
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeeklyStats = async () => {
    debugLog("🔄 WeeklyTaskStats: Fetching for user:", currentUser);
    setLoading(true);
    setError(null);

    try {
      const { data } = await apiRequest(
        `${API_ENDPOINTS.weeklyStats}?user=${currentUser || "tester"}`,
      );
      setWeeklyStats(data);
    } catch (error) {
      console.error("Error fetching weekly stats:", error);
      setError(error.message);
      setWeeklyStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyStats();
  }, [currentUser, refreshTrigger]);

  if (loading) {
    return (
      <div className="px-5 py-4 animate-pulse">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[var(--paper-shadow)] rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !weeklyStats) {
    return (
      <div className="px-5 py-6 text-center text-sm text-ink-mute italic">
        Diary couldn't be opened — try again later.
        <button
          onClick={fetchWeeklyStats}
          className="ml-2 underline text-rose hover:text-ink-soft"
        >
          retry
        </button>
      </div>
    );
  }

  // Choose intensity colour based on count
  const getCellStyle = (count, maxCount, isToday) => {
    const baseBorder = isToday ? "var(--accent-rose-deep)" : "var(--frame)";
    if (count === 0) {
      return {
        backgroundColor: "var(--paper)",
        borderColor: baseBorder,
        color: "var(--ink-mute)",
      };
    }
    const intensity = Math.min(1, count / Math.max(1, maxCount));
    // Interpolate between paper and gold
    return {
      backgroundColor: `rgba(212, 160, 76, ${0.15 + intensity * 0.55})`,
      borderColor: baseBorder,
      color: "var(--ink)",
    };
  };

  const maxCount = Math.max(
    ...weeklyStats.daily_breakdown.map((d) => d.completed_tasks),
    1,
  );

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs text-ink-mute tracking-wide uppercase">
          {new Date(weeklyStats.week_start).toLocaleDateString("en-GB", {
            month: "short",
            day: "numeric",
          })}{" "}
          —{" "}
          {new Date(weeklyStats.week_end).toLocaleDateString("en-GB", {
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="text-sm text-ink-soft">
          <span className="font-display text-2xl text-gold tabular-nums">
            {weeklyStats.total_completed_this_week}
          </span>{" "}
          quests done
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeklyStats.daily_breakdown.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            <div
              className={`w-full aspect-square flex items-center justify-center border-2 rounded-sm text-lg font-semibold tabular-nums transition-colors ${
                day.is_today ? "shadow-[0_0_0_2px_var(--paper)]" : ""
              }`}
              style={getCellStyle(day.completed_tasks, maxCount, day.is_today)}
            >
              {day.completed_tasks > 0 ? day.completed_tasks : "—"}
            </div>
            <span
              className={`text-[11px] tracking-wider uppercase ${
                day.is_today ? "text-rose font-semibold" : "text-ink-mute"
              }`}
            >
              {day.day_name}
            </span>
          </div>
        ))}
      </div>

      <div className="paper-divider mt-4">
        <span>
          {weeklyStats.completion_percentage}% completion
          {weeklyStats.total_completed_this_week > 0 && " — keep going"}
        </span>
      </div>
    </div>
  );
}
