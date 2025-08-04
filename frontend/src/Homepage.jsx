import { useState, useEffect } from 'react';
import BottomNav from './components/BottomNav';
import EncouragementBanner from './components/EncouragementBanner';
import StatsPanel from './components/StatsPanel';
import UserProfileCard from './components/UserProfileCard';
import TaskList from './components/TaskList';
import TaskCard from './components/TaskCard';

export default function Homepage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mock user data
  const user = {
    name: "Elena",
    level: 5,
    streak: 7,
    avatar: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMTAwIiBmaWxsPSIjZmM5MWJmIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTUwIiByeD0iNDAiIHJ5PSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4K"
  };

  // Mock stats data
  const stats = {
    intelligence: 75,
    discipline: 60,
    energy: 85,
    charisma: 70,
    stress: 30
  };

  // Load tasks from API
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      console.log('🔍 Starting to fetch tasks...');
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8001/api/tasks/');
      console.log('📡 Response received:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Data successfully parsed:', data);
        setTasks(data);
        setError(null);
      } else {
        console.log('❌ Response not ok:', response.status);
        setError('Unable to fetch task data');
      }
    } catch (err) {
      console.log('🚫 Fetch error occurred:', err);
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
      console.log('🏁 Fetch completed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-purple-800 text-xl">🎮 Loading your adventure...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="font-bold mb-2">❌ Connection Error</h2>
          <p className="mb-4">{error}</p>
          <button 
            onClick={fetchTasks}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 pb-20">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* User Profile Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <UserProfileCard user={user} />
        </div>

        {/* Encouragement Banner */}
        <EncouragementBanner />

        {/* Stats Panel */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Your Stats</h3>
          <StatsPanel stats={stats} />
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Today's Quests</h3>
          
          {/* Show first task as a featured card */}
          {tasks.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-medium mb-3 text-purple-800">Featured Quest</h4>
              <TaskCard task={tasks[0]} />
            </div>
          )}
          
          {/* Show all tasks in list format */}
          <TaskList tasks={tasks} />
        </div>

        {/* Refresh Button */}
        <div className="text-center">
          <button 
            onClick={fetchTasks}
            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105"
          >
            🔄 Refresh Quests
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
