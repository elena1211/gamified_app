import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, CheckCircle } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { debugLog } from '../utils/logger';

export default function WeeklyTaskStats({ currentUser, refreshTrigger }) {
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeeklyStats = async () => {
    debugLog('🔄 WeeklyTaskStats: Fetching weekly stats for user:', currentUser, 'refreshTrigger:', refreshTrigger);
    setLoading(true);
    setError(null);

    try {
      const { data } = await apiRequest(`${API_ENDPOINTS.weeklyStats}?user=${currentUser || 'tester'}`);
      debugLog('📊 WeeklyTaskStats: Received data:', data);
      setWeeklyStats(data);
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
      setError(error.message);
      // Fallback data
      setWeeklyStats({
        week_start: '2025-08-11',
        week_end: '2025-08-17',
        total_completed_this_week: 12,
        total_available_tasks: 8,
        completion_percentage: 21.4,
        daily_breakdown: [
          { date: '2025-08-11', day_name: 'Mon', completed_tasks: 3, is_today: false },
          { date: '2025-08-12', day_name: 'Tue', completed_tasks: 2, is_today: true },
          { date: '2025-08-13', day_name: 'Wed', completed_tasks: 0, is_today: false },
          { date: '2025-08-14', day_name: 'Thu', completed_tasks: 0, is_today: false },
          { date: '2025-08-15', day_name: 'Fri', completed_tasks: 0, is_today: false },
          { date: '2025-08-16', day_name: 'Sat', completed_tasks: 0, is_today: false },
          { date: '2025-08-17', day_name: 'Sun', completed_tasks: 0, is_today: false }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    debugLog('🔄 WeeklyTaskStats: useEffect triggered with currentUser:', currentUser, 'refreshTrigger:', refreshTrigger);
    fetchWeeklyStats();
  }, [currentUser, refreshTrigger]); // Remove fetchWeeklyStats to prevent infinite re-renders

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="text-center text-red-600">
          <p className="text-sm">Failed to load weekly stats</p>
          <button
            onClick={fetchWeeklyStats}
            className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const getCompletionColor = (count) => {
    if (count === 0) return 'bg-gray-100 text-gray-400';
    if (count <= 2) return 'bg-green-100 text-green-600';
    if (count <= 4) return 'bg-blue-100 text-blue-600';
    return 'bg-purple-100 text-purple-600';
  };

  const getCompletionHeight = (count) => {
    const maxHeight = 48; // 12 * 4 (h-12)
    const height = Math.min((count / Math.max(...weeklyStats.daily_breakdown.map(d => d.completed_tasks), 1)) * maxHeight, maxHeight);
    return Math.max(height, 8); // Minimum height for visibility
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Weekly Task Tracking</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-600">
            {weeklyStats.total_completed_this_week}
          </div>
          <div className="text-xs text-gray-500">tasks completed</div>
        </div>
      </div>

      {/* Week Range */}
      <div className="text-sm text-gray-600 mb-4">
        {new Date(weeklyStats.week_start).toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric'
        })} - {new Date(weeklyStats.week_end).toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric'
        })}
      </div>

      {/* Daily Chart */}
      <div className="mb-4">
        <div className="flex items-end justify-between gap-1 h-16 mb-2">
          {weeklyStats.daily_breakdown.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full rounded-t transition-all duration-300 flex items-end justify-center text-xs font-medium ${getCompletionColor(day.completed_tasks)} ${day.is_today ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}`}
                style={{ height: `${getCompletionHeight(day.completed_tasks)}px` }}
              >
                {day.completed_tasks > 0 && (
                  <span className="pb-1">{day.completed_tasks}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Day Labels */}
        <div className="flex justify-between text-xs text-gray-500">
          {weeklyStats.daily_breakdown.map((day, index) => (
            <div
              key={index}
              className={`flex-1 text-center ${day.is_today ? 'font-semibold text-purple-600' : ''}`}
            >
              {day.day_name}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Completion Rate</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {weeklyStats.completion_percentage}%
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Daily Average</span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {(weeklyStats.total_completed_this_week / 7).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Motivational Message */}
      {weeklyStats.total_completed_this_week > 0 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
          <p className="text-sm text-purple-700 text-center">
            {weeklyStats.total_completed_this_week >= 20
              ? "🎉 Amazing week! You've completed loads of tasks!"
              : weeklyStats.total_completed_this_week >= 10
              ? "💪 Well done! Keep up the great pace!"
              : "✨ Good start! Keep going!"}
          </p>
        </div>
      )}
    </div>
  );
}
