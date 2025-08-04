import React from 'react';
import EncouragementBanner from './components/EncouragementBanner';
import UserProfileCard from './components/UserProfileCard';
import StatsPanel from './components/StatsPanel';
import TaskList from './components/TaskList';
import BottomNav from './components/BottomNav';

function App() {
  const user = {
    name: "Elena",
    level: 6,
    streak: 5,
    avatar: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMTAwIiBmaWxsPSIjZmM5MWJmIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTUwIiByeD0iNDAiIHJ5PSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4K",
    stats: {
      intelligence: 75,
      discipline: 60,
      energy: 50,
      charisma: 40,
      stress: 70
    }
  };

  console.log('App.jsx user.stats:', user.stats); // Debug log

  const tasks = [
    { id: 1, title: "🧠 Practice Leetcode Problem", tip: "Complete within 25 minutes", reward: "+2 Knowledge", completed: false },
    { id: 2, title: "📚 Read 30 pages", tip: "Focus on key concepts", reward: "+3 Knowledge", completed: false },
    { id: 3, title: "🏃‍♂️ 30-minute workout", tip: "Include cardio and strength", reward: "+2 Strength", completed: true }
  ];

  return (
    <div className="min-h-screen bg-pink-50 text-gray-800">
      {/* Container with proper mobile spacing */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4 pb-24">
        <EncouragementBanner />
        <UserProfileCard user={user} />
        <StatsPanel stats={user.stats} />
        <TaskList tasks={tasks} />
      </div>
      
      {/* Bottom Navigation - Fixed at bottom */}
      <BottomNav />
    </div>
  );
}

export default App;