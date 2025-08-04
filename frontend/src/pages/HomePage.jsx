import { useState, useEffect } from 'react';
import EncouragementBanner from "../components/EncouragementBanner";
import UserProfileCard from "../components/UserProfileCard";
import StatsPanel from "../components/StatsPanel";
import TaskList from "../components/TaskList";
import BottomNav from "../components/BottomNav";

export default function HomePage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = {
    name: "Elena",
    level: 6,
    streak: 5,
    avatar: "https://via.placeholder.com/96x96/ff69b4/ffffff?text=E",
    stats: {
      intelligence: 75,
      discipline: 60,
      energy: 50,
      charisma: 40,
      stress: 70
    }
  };

  // Fetch tasks from API
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
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
        setError('Unable to fetch tasks');
      }
    } catch (err) {
      console.log('🚫 Connection error:', err);
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-[#460303] text-xl">🎮 Loading your adventure...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="font-bold mb-2">❌ Connection Error</h2>
          <p className="mb-4">{error}</p>
          <button 
            onClick={fetchTasks}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[#460303] p-4 space-y-4 pb-20">
      <EncouragementBanner />
      <UserProfileCard user={user} />
      <StatsPanel stats={user.stats} />
      <TaskList tasks={tasks} />
      <BottomNav />
    </div>
  );
}
