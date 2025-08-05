import { useState, useEffect } from 'react';
import BottomNav from './components/BottomNav';
import StatsPanel from './components/StatsPanel';
import UserProfileCard from './components/UserProfileCard';
import TaskList from './components/TaskList';
import TaskCard from './components/TaskCard';
import TimeLimitedTaskPopup from './components/TimeLimitedTaskPopup';
import WarningPopup from './components/WarningPopup';

export default function Homepage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeLimitedTask, setShowTimeLimitedTask] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState('');

  const [stats, setStats] = useState({
    knowledge: 75,
    discipline: 60,
    energy: 85,
    charisma: 70,
    stress: 30
  });

  // Time-limited task data
  const timeLimitedTasks = [
    {
      title: "Start Reading Now",
      description: "Pick up a book or open an e-book and start reading for 5 minutes",
      duration: 300,
      reward: "+3 Knowledge, +2 Discipline",
      penalty: "-1 Energy, -1 Knowledge"
    },
    {
      title: "Get Ready for Library",
      description: "Pack your bag, get dressed, and prepare to go to the library in 1 minute",
      duration: 60,
      reward: "+2 Energy, +1 Discipline",
      penalty: "-2 Energy, -1 Discipline"
    },
    {
      title: "Clean Your Desk Now",
      description: "Clear your desk and organise all the clutter",
      duration: 180,
      reward: "+2 Discipline, +1 Charisma",
      penalty: "-1 Discipline, +1 Stress"
    }
  ];

  const [currentTimeLimitedTask, setCurrentTimeLimitedTask] = useState(null);

  const user = {
    name: "Elena",
    level: 5,
    streak: 7,
    avatar: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMTAwIiBmaWxsPSIjZmM5MWJmIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTUwIiByeD0iNDAiIHJ5PSIzMCIgZmlsbD0iI2ZmZmZmZiIvPgo8L3N2Zz4K"
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Show random time-limited task after 3 seconds for testing
  useEffect(() => {
    const timer = setTimeout(() => {
      const randomTask = timeLimitedTasks[Math.floor(Math.random() * timeLimitedTasks.length)];
      setCurrentTimeLimitedTask(randomTask);
      setShowTimeLimitedTask(true);
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleAcceptTask = () => {
    if (currentTimeLimitedTask) {
      applyStatChanges(currentTimeLimitedTask.reward, true);
    }
    
    setShowTimeLimitedTask(false);
    setCurrentTimeLimitedTask(null);
  };

  const handleRejectTask = () => {
    if (currentTimeLimitedTask) {
      applyStatChanges(currentTimeLimitedTask.penalty, false);
    }
    
    setShowTimeLimitedTask(false);
    setCurrentTimeLimitedTask(null);
    setWarningType('rejection');
    setShowWarning(true);
  };

  const handleTimeUp = () => {
    if (currentTimeLimitedTask) {
      applyStatChanges(currentTimeLimitedTask.penalty, false);
    }
    
    setShowTimeLimitedTask(false);
    setCurrentTimeLimitedTask(null);
    setWarningType('timeout');
    setShowWarning(true);
  };

  const handleWarningClose = () => {
    setShowWarning(false);
  };

  const handleTaskComplete = (task) => {
    if (task.reward) {
      applyStatChanges(task.reward, true);
    }
  };

  const handleTaskUncomplete = (task) => {
    if (task.reward) {
      // Reverse the previously awarded points
      const reverseReward = task.reward.replace(/\+/g, '-');
      applyStatChanges(reverseReward, false);
    }
  };

  const handleTaskFail = (task) => {
    // Minor negative effect for task failure
    const penalty = "-1 Energy, +1 Stress";
    applyStatChanges(penalty, false);
  };

  const applyStatChanges = (changeString, isReward) => {
    // Parse change strings like "+3 Knowledge, +2 Discipline" or "-1 Energy, -1 Knowledge"
    const changes = changeString.split(',').map(change => change.trim());
    
    setStats(prevStats => {
      const newStats = { ...prevStats };
      
      changes.forEach(change => {
        const match = change.match(/([+-]\d+)\s+(\w+)/i);
        if (match) {
          const [, valueStr, statName] = match;
          const value = parseInt(valueStr);
          const statKey = statName.toLowerCase();
          
          if (newStats.hasOwnProperty(statKey)) {
            newStats[statKey] = Math.max(0, Math.min(100, newStats[statKey] + value));
          }
        }
      });
      
      return newStats;
    });
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8002/api/tasks/');
      
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
        setError(null);
      } else {
        setError('Unable to fetch task data');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
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
      <div className="container mx-auto px-4 py-6 space-y-6">
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <UserProfileCard user={user} />
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <StatsPanel stats={stats} />
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Today's Quests</h3>
          
          <TaskList 
            tasks={tasks} 
            onTaskComplete={handleTaskComplete}
            onTaskUncomplete={handleTaskUncomplete}
          />
        </div>

        <div className="text-center">
          <div className="flex justify-center gap-3 mb-4">
            <button 
              onClick={fetchTasks}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105"
            >
              🔄 Refresh Quests
            </button>
            
            <button 
              onClick={() => {
                const randomTask = timeLimitedTasks[Math.floor(Math.random() * timeLimitedTasks.length)];
                setCurrentTimeLimitedTask(randomTask);
                setShowTimeLimitedTask(true);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105"
            >
              ⚡ Test Time-Limited Quest
            </button>
          </div>
        </div>
      </div>

      <BottomNav />

      {showTimeLimitedTask && currentTimeLimitedTask && (
        <div style={{ position: 'relative', zIndex: 9999 }}>
          <TimeLimitedTaskPopup
            task={currentTimeLimitedTask}
            onAccept={handleAcceptTask}
            onReject={handleRejectTask}
            onTimeUp={handleTimeUp}
          />
        </div>
      )}

      {showWarning && currentTimeLimitedTask && (
        <div style={{ position: 'relative', zIndex: 9999 }}>
          <WarningPopup
            type={warningType}
            penalty={currentTimeLimitedTask.penalty}
            onClose={handleWarningClose}
          />
        </div>
      )}
    </div>
  );
}
