import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { EMOJIS } from '../config/constants.js';

/**
 * Main Goal component displays the user's primary objective
 * Shows goal details, progress tracking, and creation date
 */
export default function MainGoal({ currentUser }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useTranslation('dashboard');

  const fetchGoal = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiRequest(`${API_ENDPOINTS.goal}?user=${currentUser || 'elena'}`);
      setGoal(data);
      setError(null);
    } catch (err) {
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
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
        <div className="animate-pulse">
          <div className="h-6 bg-white/30 rounded mb-2"></div>
          <div className="h-4 bg-white/20 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 rounded-2xl p-6">
        <h3 className="font-bold mb-2">❌ Unable to load goal</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!goal) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-start gap-4">
        <div className="text-4xl">{EMOJIS.goal}</div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">{t('mainGoal')}</h2>
          <h3 className="text-xl font-semibold mb-3">{goal.title}</h3>
          <p className="text-white/90 leading-relaxed">
            {goal.description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <span>📅 {t('time.started', { ns: 'common' })}:</span>
            <span>{new Date(goal.created_at).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
      </div>
      
      {/* Progress indicator - placeholder for future implementation */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{t('common:progress')}</span>
          <span className="text-sm">0%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div className="bg-white h-2 rounded-full w-0 transition-all duration-300"></div>
        </div>
      </div>
    </div>
  );
}
