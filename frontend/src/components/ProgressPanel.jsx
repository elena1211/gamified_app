import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Target, Clock } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import ProgressBar from './ProgressBar.jsx';

export default function ProgressPanel({ currentUser, onRefresh = null }) {
  const [todayStats, setTodayStats] = useState(null);
  const [weekStats, setWeekStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgressStats = async () => {
    try {
      setLoading(true);
      
      // Fetch both today and week stats in parallel
      const [todayResponse, weekResponse] = await Promise.all([
        apiRequest(`${API_ENDPOINTS.userProgress}?user=${currentUser || 'elena'}&range=today`),
        apiRequest(`${API_ENDPOINTS.userProgress}?user=${currentUser || 'elena'}&range=week`)
      ]);
      
      setTodayStats(todayResponse.data);
      setWeekStats(weekResponse.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching progress stats:', err);
      setError('Failed to load progress data');
      
      // Set fallback data
      setTodayStats({
        range: 'today',
        assigned: 3,
        completed: 2,
        completion_rate: 0.67,
        streak: 2
      });
      setWeekStats({
        range: 'week',
        assigned: 15,
        completed: 10,
        completion_rate: 0.67,
        streak: 2
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressStats();
  }, [currentUser]);

  // Refresh function for external calls (when tasks are completed)
  useEffect(() => {
    if (onRefresh) {
      onRefresh.current = fetchProgressStats;
    }
  }, [onRefresh]);

  const getProgressColor = (rate) => {
    if (rate >= 0.8) return 'green';
    if (rate >= 0.6) return 'blue';
    if (rate >= 0.4) return 'orange';
    return 'pink';
  };

  const getMotivationMessage = (rate) => {
    if (rate === 1) return "🎉 Perfect! All tasks completed!";
    if (rate >= 0.8) return "🌟 Excellent progress! Keep it up!";
    if (rate >= 0.6) return "👍 Good work! You're on track!";
    if (rate >= 0.4) return "💪 Getting there! Keep pushing!";
    return "🚀 Let's get started! You've got this!";
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Progress Tracking</h3>
        </div>
        <div className="space-y-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Progress Tracking</h3>
        </div>
        <button
          onClick={fetchProgressStats}
          className="text-purple-600 hover:text-purple-800 transition-colors"
          title="Refresh Progress"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Today's Progress */}
        {todayStats && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-pink-500" />
                <span className="font-medium text-gray-700">Today's Progress</span>
              </div>
              <div className="text-sm text-gray-600">
                {todayStats.completed}/{todayStats.assigned} tasks
              </div>
            </div>
            
            <ProgressBar 
              value={todayStats.completion_rate}
              color={getProgressColor(todayStats.completion_rate)}
              label=""
              showPercentage={true}
              animated={true}
            />
            
            <p className="text-sm text-gray-600 italic">
              {getMotivationMessage(todayStats.completion_rate)}
            </p>
          </div>
        )}

        {/* Weekly Progress */}
        {weekStats && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-gray-700">This Week</span>
              </div>
              <div className="text-sm text-gray-600">
                {weekStats.completed}/{weekStats.assigned} tasks
              </div>
            </div>
            
            <ProgressBar 
              value={weekStats.completion_rate}
              color={getProgressColor(weekStats.completion_rate)}
              label=""
              showPercentage={true}
              animated={true}
            />
            
            {weekStats.streak > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-orange-500">🔥</span>
                <span className="text-gray-600">
                  {weekStats.streak} day streak! 
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
