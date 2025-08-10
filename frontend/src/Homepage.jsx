import { useState, useEffect, useCallback } from 'react';
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

export default function Homepage({ currentUser, onNavigateToSettings, onNavigateToTaskManager }) {
  console.log('Homepage component starting to render, currentUser:', currentUser);
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeLimitedTask, setShowTimeLimitedTask] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState('');
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  const [stats, setStats] = useState({
    knowledge: 75,
    discipline: 60,
    energy: 85,
    charisma: 70,
    stress: 30
  });

  // Time-limited task data
  const [currentTimeLimitedTask, setCurrentTimeLimitedTask] = useState(null);
  const [lastDismissedTask, setLastDismissedTask] = useState(null);

  const [user, setUser] = useState({
    name: currentUser || "Elena",
    level: 5,
    streak: 0,
    avatar: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxMDAiIGZpbGw9IiNmYzkxYmYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iODAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNTAiIHJ4PSI0MCIgcnk9IjMwIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo="
  });

  const [userStats, setUserStats] = useState(null);

  const handleAcceptTask = () => {
    if (currentTimeLimitedTask) {
      applyStatChanges(currentTimeLimitedTask.reward);
    }
    
    setShowTimeLimitedTask(false);
    setCurrentTimeLimitedTask(null);
  };

  const handleRejectTask = () => {
    // Show confirmation dialog instead of immediately rejecting
    setShowDismissConfirm(true);
  };

  const handleConfirmDismiss = () => {
    if (currentTimeLimitedTask) {
      applyStatChanges(currentTimeLimitedTask.penalty);
      setLastDismissedTask(currentTimeLimitedTask); // Save for warning dialog
    }
    
    setShowTimeLimitedTask(false);
    setCurrentTimeLimitedTask(null);
    setShowDismissConfirm(false);
    setWarningType('rejection');
    setShowWarning(true);
  };

  const handleCancelDismiss = () => {
    setShowDismissConfirm(false);
  };

  const handleTimeUp = () => {
    if (currentTimeLimitedTask) {
      applyStatChanges(currentTimeLimitedTask.penalty);
      setLastDismissedTask(currentTimeLimitedTask); // Save for warning dialog
    }
    
    setShowTimeLimitedTask(false);
    setCurrentTimeLimitedTask(null);
    setWarningType('timeout');
    setShowWarning(true);
  };

  const handleWarningClose = () => {
    setShowWarning(false);
    setLastDismissedTask(null); // Clear saved task data
  };

  const handleSettingsClick = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const handleTaskManagerClick = () => {
    if (onNavigateToTaskManager) {
      onNavigateToTaskManager();
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
            applyStatChanges(task.reward);
          } else if (!data.task_completed && task.reward) {
            // Task uncompleted: reverse the stat changes
            const reverseReward = task.reward.replace(/\+/g, '-');
            applyStatChanges(reverseReward);
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
        applyStatChanges(task.reward);
      }
    }
  };

  const applyStatChanges = (changeString) => {
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
          
          if (Object.prototype.hasOwnProperty.call(newStats, statKey)) {
            newStats[statKey] = Math.max(0, Math.min(100, newStats[statKey] + value));
          }
        }
      });
      
      return newStats;
    });
  };

  // Helper function to randomly select 3 balanced daily tasks
  const selectDailyTasks = (allTasks) => {
    if (allTasks.length <= 3) {
      return allTasks;
    }

    // Group tasks by difficulty for balanced selection
    const tasksByDifficulty = {
      1: allTasks.filter(task => task.difficulty === 1),
      2: allTasks.filter(task => task.difficulty === 2),
      3: allTasks.filter(task => task.difficulty === 3 || !task.difficulty)
    };

    const selectedTasks = [];
    
    // Try to get one task from each difficulty level
    for (let difficulty = 1; difficulty <= 3; difficulty++) {
      const tasksInDifficulty = tasksByDifficulty[difficulty];
      if (tasksInDifficulty.length > 0) {
        const randomIndex = Math.floor(Math.random() * tasksInDifficulty.length);
        selectedTasks.push(tasksInDifficulty[randomIndex]);
      }
    }

    // If we still need more tasks, randomly pick from remaining tasks
    while (selectedTasks.length < 3 && selectedTasks.length < allTasks.length) {
      const remainingTasks = allTasks.filter(task => 
        !selectedTasks.some(selected => selected.id === task.id)
      );
      
      if (remainingTasks.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingTasks.length);
        selectedTasks.push(remainingTasks[randomIndex]);
      } else {
        break;
      }
    }

    console.log('🎲 Selected daily tasks:', selectedTasks);
    return selectedTasks;
  };

  const fetchTasks = useCallback(async (preventScroll = false) => {
    console.log('fetchTasks called, currentUser:', currentUser);
    try {
      if (!preventScroll) {
        setLoading(true);
      }
      
      const url = `${API_ENDPOINTS.tasks}?user=${currentUser || 'elena'}`;
      console.log('Fetching tasks from:', url);
      const { data } = await apiRequest(url);
      console.log('All tasks fetched:', data);
      
      // Select 3 random daily tasks from the full list
      const selectedTasks = selectDailyTasks(data);
      setTasks(selectedTasks);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      // Set default tasks if API fails - expanded pool for random selection
      const fallbackTasks = [
        {id: 1, title: "🧹 Organise workspace", tip: "Clean and organise your desk", reward: "+4 Discipline", completed: false, difficulty: 1, attribute: "discipline"},
        {id: 2, title: "📝 Write journal entry", tip: "Reflect on today's experiences", reward: "+3 Discipline", completed: false, difficulty: 1, attribute: "discipline"},
        {id: 3, title: "🏃‍♂️ 30-minute workout", tip: "Include cardio and strength training", reward: "+6 Energy", completed: false, difficulty: 2, attribute: "energy"},
        {id: 4, title: "💻 Practice coding", tip: "Solve a Leetcode problem", reward: "+5 Knowledge", completed: false, difficulty: 2, attribute: "knowledge"},
        {id: 5, title: "🧘‍♀️ Meditation", tip: "10 minutes of mindfulness", reward: "+3 Energy, +2 Discipline", completed: false, difficulty: 1, attribute: "energy"},
        {id: 6, title: "📚 Learn something new", tip: "Read an educational article", reward: "+4 Knowledge", completed: false, difficulty: 1, attribute: "knowledge"}
      ];
      const selectedTasks = selectDailyTasks(fallbackTasks);
      setTasks(selectedTasks);
      setError(null); // Don't show error if we have fallback data
    } finally {
      if (!preventScroll) {
        setLoading(false);
      }
    }
  }, [currentUser]);

  const fetchUserStats = useCallback(async () => {
    console.log('fetchUserStats called, currentUser:', currentUser);
    try {
      const url = `${API_ENDPOINTS.userStats}?user=${currentUser || 'elena'}`;
      console.log('Fetching user stats from:', url);
      const { data } = await apiRequest(url);
      console.log('User stats fetched successfully:', data);
      
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
      // Set default user stats if API fails
      setUserStats({
        level: 5,
        current_streak: 3,
        total_tasks_completed: 25,
        total_score: 1250
      });
    }
  }, [currentUser]);

  // Initialize data on component mount
  useEffect(() => {
    console.log('Homepage useEffect running, about to fetch data');
    fetchTasks();
    fetchUserStats();
  }, [fetchTasks, fetchUserStats]);

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

  console.log('Homepage about to render, loading:', loading, 'error:', error);

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
              🎲 New Daily Tasks
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
        <BottomNav 
          onSettingsClick={handleSettingsClick} 
          onTaskManagerClick={handleTaskManagerClick}
        />
        
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
        {showWarning && lastDismissedTask && (
          <Modal
            isOpen={showWarning}
            onClose={handleWarningClose}
            title={warningType === 'rejection' ? 'Quest Dismissed!' : 'Time\'s Up!'}
            message={warningType === 'rejection' ? 'You chose to avoid the challenge...' : 'The quest time has ended...'}
            type="game-penalty"
            variant="notification"
            penalty={lastDismissedTask.penalty}
            showCloseButton={false}
          />
        )}
        
        {/* Dismiss Confirmation Dialog */}
        {showDismissConfirm && currentTimeLimitedTask && (
          <Modal
            isOpen={showDismissConfirm}
            onClose={handleCancelDismiss}
            onConfirm={handleConfirmDismiss}
            title="Confirm Quest Dismissal"
            message={`Are you sure you want to dismiss this quest? You will lose: ${currentTimeLimitedTask.penalty}`}
            confirmText="Yes, Dismiss Quest"
            cancelText="Continue Quest"
            type="danger"
            variant="confirmation"
          />
        )}
      </div>
    </div>
  );
}