import { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiRequest } from './config/api.js';
import { COLORS, EMOJIS } from './config/constants.js';
import BottomNav from './components/BottomNav';
import StatsPanel from './components/StatsPanel';
import UserProfileCard from './components/UserProfileCard';
import TaskList from './components/TaskList';
import MainGoal from './components/MainGoal';
import TimeLimitedTaskPopup from './components/TimeLimitedTaskPopup';
import Modal from './components/Modal';

// Time-limited task data
const TIME_LIMITED_TASKS = [
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

export default function Homepage({ currentUser, onLogout, onNavigateToSettings }) {
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
  const [currentTimeLimitedTask, setCurrentTimeLimitedTask] = useState(null);

  const [user, setUser] = useState({
    name: currentUser || "Elena",
    level: 5,
    streak: 0,
    avatar: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxMDAiIGZpbGw9IiNmYzkxYmYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iODAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNTAiIHJ4PSI0MCIgcnk9IjMwIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo="
  });

  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchUserStats();
  }, []);

  // Show random time-limited task after 3 seconds for testing
  useEffect(() => {
    const timer = setTimeout(() => {
      const randomTask = TIME_LIMITED_TASKS[Math.floor(Math.random() * TIME_LIMITED_TASKS.length)];
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

  const handleSettingsClick = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const handleTaskComplete = async (task) => {    
    try {
      // Call backend API to toggle task completion status
      const response = await fetch(API_ENDPOINTS.taskComplete, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          task_id: task.id,
          user: currentUser || 'elena'
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Show progress message - removed console.log for production

          // Update local task state to reflect the change
          setTasks(prevTasks => prevTasks.map(t => 
            t.id === task.id 
              ? { ...t, completed: data.task_completed }
              : t
          ));

          // Apply stat changes based on task completion status
          if (data.task_completed && task.reward) {
            // Task completed: apply positive stat changes
            applyStatChanges(task.reward, true);
          } else if (!data.task_completed && task.reward) {
            // Task uncompleted: reverse the stat changes
            const reverseReward = task.reward.replace(/\+/g, '-');
            applyStatChanges(reverseReward, false);
          }

          // Update streak based on API response
          setUser(prevUser => {
            const newUser = { ...prevUser, streak: data.streak };
            console.log(`👤 Updating streak from ${prevUser.streak} to ${data.streak}`);
            return newUser;
          });

          // Update user stats to reflect the total completed tasks change
          fetchUserStats();
        } else {
          // Task completion failed - removed console.log for production
        }
      } else {
        console.error('Failed to complete task');
      }
    } catch (err) {
      console.error('Error completing task:', err);
      
      // Fallback to local stat changes if API fails
      if (task.reward) {
        applyStatChanges(task.reward, true);
      }
    }
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

  const fetchTasks = async (preventScroll = false) => {
    try {
      if (!preventScroll) {
        setLoading(true);
      }
      
      const { data } = await apiRequest(`${API_ENDPOINTS.tasks}?user=${currentUser || 'elena'}`);
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!preventScroll) {
        setLoading(false);
      }
    }
  };

  const fetchUserStats = async () => {
    try {
      const { data } = await apiRequest(`${API_ENDPOINTS.userStats}?user=${currentUser || 'elena'}`);
      
      setUserStats(data);
      setUser(prevUser => {
        const newUser = {
          ...prevUser,
          level: data.level,
          streak: data.current_streak
        };
        return newUser;
      });
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
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
            onClick={() => fetchTasks(false)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 !px-8 !py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-8 shadow-md flex flex-col items-center">
          <UserProfileCard user={user} userStats={userStats} />
        </div>
        {/* Main Goal */}
        <MainGoal currentUser={currentUser} />
        {/* Stats Panel */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <StatsPanel stats={stats} />
        </div>
        {/* Task List */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <TaskList 
            tasks={tasks} 
            onTaskComplete={handleTaskComplete}
          />
        </div>
        {/* Control Buttons */}
        <div className="text-center">
          <div className="flex justify-center gap-3 mb-4">
            <button 
              onClick={(e) => {
                e.preventDefault();
                fetchTasks(true);
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105"
            >
              🔄 Refresh Quests
            </button>
            <button 
              onClick={() => {
                const randomTask = TIME_LIMITED_TASKS[Math.floor(Math.random() * TIME_LIMITED_TASKS.length)];
                setCurrentTimeLimitedTask(randomTask);
                setShowTimeLimitedTask(true);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl shadow-md transition-all duration-300 hover:scale-105"
            >
              ⚡ Test Time-Limited Quest
            </button>
          </div>
        </div>
        <BottomNav onSettingsClick={handleSettingsClick} />
        
        {/* Popups */}
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
          <Modal
            isOpen={showWarning}
            onClose={handleWarningClose}
            title={warningType === 'rejection' ? 'Quest Dismissed!' : 'Time\'s Up!'}
            message={warningType === 'rejection' ? 'You chose to avoid the challenge...' : 'The quest time has ended...'}
            type="game-penalty"
            variant="notification"
            penalty={currentTimeLimitedTask.penalty}
            showCloseButton={false}
          />
        )}
      </div>
    </div>
  );
}