import { useState, useEffect } from 'react';

const API_ENDPOINTS = {
  goal: 'http://127.0.0.1:8002/api/goal/'
};

export default function MainGoal({ currentUser }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGoal();
  }, []);

  const fetchGoal = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ENDPOINTS.goal}?user=${currentUser || 'elena'}`);
      
      if (response.ok) {
        const data = await response.json();
        setGoal(data);
        setError(null);
      } else {
        setError('Unable to fetch goal data');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="text-4xl">🎯</div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">Main Goal</h2>
          <h3 className="text-xl font-semibold mb-3">{goal.title}</h3>
          <p className="text-white/90 leading-relaxed">
            {goal.description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <span>📅 Started:</span>
            <span>{new Date(goal.created_at).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
      </div>
      
      {/* Progress indicator (placeholder for now) */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm">0%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div className="bg-white h-2 rounded-full w-0 transition-all duration-300"></div>
        </div>
      </div>
    </div>
  );
}
