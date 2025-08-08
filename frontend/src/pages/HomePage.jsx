import { useState, useEffect, useCallback } from 'react';
import UserProfileCard from "../components/UserProfileCard";
import StatsPanel from "../components/StatsPanel";
import TaskList from "../components/TaskList";
import BottomNav from "../components/BottomNav";
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation('dashboard');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = {
    name: "Elena",
    level: 6,
    streak: 5,
    avatar: "https://via.placeholder.com/96x96/ff69b4/ffffff?text=E",
    stats: {
      knowledge: 75,
      discipline: 60,
      energy: 50,
      charisma: 40,
      stress: 70
    }
  };

  const fetchTasks = useCallback(async () => {
    try {
      console.log('🔍 Fetching tasks from API...');
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8001/api/tasks/');
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Tasks loaded:', data);
        setTasks(data);
        setError(null);
      } else {
        console.log('❌ API Error:', response.status);
        setError(t('networkError'));
      }
    } catch (err) {
      console.log('🚫 Connection error:', err);
      setError(`${t('networkError')}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Fetch tasks from API
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-[#460303] text-xl">🎮 {t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="font-bold mb-2">❌ {t('error')}</h2>
          <p className="mb-4">{error}</p>
          <button 
            onClick={fetchTasks}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[#460303] p-4 space-y-4 pb-20">
      <UserProfileCard user={user} />
      <StatsPanel stats={user.stats} />
      <TaskList tasks={tasks} />
      <BottomNav />
    </div>
  );
}
