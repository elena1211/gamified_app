import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import BottomNav from '../components/BottomNav';
import StatsPanel from '../components/StatsPanel';
import UserProfileCard from '../components/UserProfileCard';
import TaskList from '../components/TaskList';
import MainGoal from '../components/MainGoal';
import TimeLimitedTaskPopup from '../components/TimeLimitedTaskPopup';
import Modal from '../components/Modal';
import WeeklyTaskStats from '../components/WeeklyTaskStats';
import LevelUpModal from '../components/LevelUpModal';
import { useAppContext } from '../context/AppContext';
import { getAvatarStage } from '../utils/avatar';

// Time-limited task data - Enhanced rewards (1-10 points)
const TIME_LIMITED_TASKS = [
  {
    title: "Start Reading Now",
    description: "Pick up a book or open an e-book and start reading for 5 minutes",
    duration: 300,
    reward: "+8 Intelligence, +5 Discipline, +2 Wellness",
    penalty: "-3 Energy, -2 Intelligence"
  },
  {
    title: "Get Ready for Library",
    description: "Pack your bag, get dressed, and prepare to go to the library in 1 minute",
    duration: 60,
    reward: "+6 Energy, +4 Discipline, +3 Social",
    penalty: "-5 Energy, -3 Discipline"
  },
  {
    title: "Clean Your Desk Now",
    description: "Clear your desk and organise all the clutter",
    duration: 180,
    reward: "+7 Discipline, +6 Wellness, +2 Energy",
    penalty: "-4 Discipline, +3 Stress"
  }
];

export default function HomePage({ currentUser, onNavigateToSettings, onNavigateToTaskManager }) {
  console.log('HomePage component starting to render, currentUser:', currentUser);

  // Use global state from context
  const {
    attributeStats,
    applyStatChanges,
    userStats,
    updateUserStats
  } = useAppContext();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeLimitedTask, setShowTimeLimitedTask] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState('');
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger for weekly stats

  // Level up modal states
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState({
    oldLevel: 0,
    newLevel: 0,
    newExp: 0,
    oldStage: 1,
    newStage: 1
  });

  // Time-limited task data
  const [currentTimeLimitedTask, setCurrentTimeLimitedTask] = useState(null);
  const [lastDismissedTask, setLastDismissedTask] = useState(null);

  const [user, setUser] = useState({
    name: currentUser || "tester",
    level: 5,
    exp: 0,
    streak: 0,
    avatar: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxMDAiIGZpbGw9IiNmYzkxYmYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iODAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNTAiIHJ4PSI0MCIgcnk9IjMwIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo="
  });

  const [localUserStats, setLocalUserStats] = useState(null);

  const handleAcceptTask = async () => {
    if (currentTimeLimitedTask) {
      try {
        // Call dynamic task completion API for time-limited tasks
        const response = await fetch(API_ENDPOINTS.dynamicTaskComplete, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task_title: currentTimeLimitedTask.title,
            task_type: 'time_limited',
            reward_points: parseInt(currentTimeLimitedTask.reward.match(/\+(\d+)/)?.[1] || '1'),
            attribute: 'discipline', // Default attribute for time-limited tasks
            user: currentUser || 'tester'
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📡 Time-limited task completion response:', data);

          if (data.success) {
            // Apply stat changes
            applyStatChanges(currentTimeLimitedTask.reward);

            // Check for level up from API response
            if (data.user_stats && data.user_stats.level_up) {
              console.log('🎉 Level up detected from time-limited task!', data.user_stats);
              const oldStage = getAvatarStage(data.user_stats.old_level);
              const newStage = getAvatarStage(data.user_stats.level);

              setLevelUpData({
                oldLevel: data.user_stats.old_level,
                newLevel: data.user_stats.level,
                newExp: data.user_stats.exp,
                oldStage,
                newStage
              });
              setShowLevelUpModal(true);
            }

            // Update user stats with level and EXP data
            if (data.user_stats) {
              updateUserStats({
                currentStreak: data.streak,
                level: data.user_stats.level,
                exp: data.user_stats.exp
              });

              // Update user state for display
              setUser(prev => ({
                ...prev,
                level: data.user_stats.level,
                exp: data.user_stats.exp,
                streak: data.streak
              }));
            } else {
              updateUserStats({ currentStreak: data.streak });

              // Update user state with streak only
              setUser(prev => ({
                ...prev,
                streak: data.streak
              }));
            }

            console.log('✅ Time-limited task completed, refreshing weekly stats in 0.3s');

            // Refresh weekly stats after time-limited task completion
            setTimeout(() => {
              setRefreshTrigger(prev => prev + 1);
              console.log('🔄 Weekly stats refresh triggered for time-limited task');
            }, 300);
          }
        }
      } catch (error) {
        console.error('Error completing time-limited task:', error);
        // Fallback to local changes
        applyStatChanges(currentTimeLimitedTask.reward);
        setRefreshTrigger(prev => prev + 1);
      }
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
      console.log('🎯 Toggling task completion:', task.id, task.title, 'Current status:', task.completed);

      // Check if it's a dynamic task (random daily tasks) or regular database task
      const isDynamicTask = task.is_random || task.id < 25; // Use dynamic API for random tasks or fallback tasks

      if (isDynamicTask) {
        // For daily tasks that are not completed yet, complete them
        if (!task.completed) {
          const response = await fetch(API_ENDPOINTS.dynamicTaskComplete, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              task_title: task.title,
              task_type: 'daily',
              reward_points: parseInt(task.reward?.match(/\+(\d+)/)?.[1] || '1'),
              attribute: task.attribute || 'discipline',
              user: currentUser || 'tester'
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log('📡 Dynamic task completion response:', data);

            if (data.success) {
              // Update local task state to reflect the change
              setTasks(prevTasks => prevTasks.map(t =>
                t.id === task.id
                  ? { ...t, completed: true }
                  : t
              ));

              // Apply stat changes based on task completion
              if (task.reward) {
                applyStatChanges(task.reward);
                console.log('📈 Applied stat changes:', task.reward);
              }

              // Check for level up from API response
              if (data.user_stats && data.user_stats.level_up) {
                console.log('🎉 Level up detected!', data.user_stats);
                const oldStage = getAvatarStage(data.user_stats.old_level);
                const newStage = getAvatarStage(data.user_stats.level);

                setLevelUpData({
                  oldLevel: data.user_stats.old_level,
                  newLevel: data.user_stats.level,
                  newExp: data.user_stats.exp,
                  oldStage,
                  newStage
                });
                setShowLevelUpModal(true);
              }

              // Update user stats with level and EXP data
              if (data.user_stats) {
                updateUserStats({
                  currentStreak: data.streak,
                  level: data.user_stats.level,
                  exp: data.user_stats.exp
                });

                // Update user state for display
                setUser(prev => ({
                  ...prev,
                  level: data.user_stats.level,
                  exp: data.user_stats.exp,
                  streak: data.streak
                }));
              } else {
                updateUserStats({ currentStreak: data.streak });

                // Update user state with streak only
                setUser(prev => ({
                  ...prev,
                  streak: data.streak
                }));
              }

              console.log('✅ Dynamic task completion successful, refreshing weekly stats in 0.3s');

              // Refresh weekly stats after task completion
              setTimeout(() => {
                setRefreshTrigger(prev => prev + 1);
                console.log('🔄 Weekly stats refresh triggered');
              }, 300);
            }
          }
        } else {
          // For daily tasks that are already completed, call uncomplete API
          console.log('🔄 Uncompleting daily task via API');
          const response = await fetch(API_ENDPOINTS.dynamicTaskUncomplete, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              task_title: task.title,
              user: currentUser || 'tester'
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log('📡 Dynamic task uncomplete response:', data);

            if (data.success) {
              // Update local task state to reflect the change
              setTasks(prevTasks => prevTasks.map(t =>
                t.id === task.id
                  ? { ...t, completed: false }
                  : t
              ));

              // Reverse stat changes for uncompleting task
              if (task.reward) {
                const reverseReward = task.reward.replace(/\+/g, '-');
                applyStatChanges(reverseReward);
                console.log('📉 Reversed stat changes:', reverseReward);
              }

              // Update streak based on API response
              updateUserStats({ currentStreak: data.streak });

              console.log('✅ Dynamic task uncomplete successful, refreshing weekly stats');

              // Immediately refresh weekly stats after task uncompletion
              setRefreshTrigger(prev => {
                const newValue = prev + 1;
                console.log('🔄 Weekly stats refresh: incrementing from', prev, 'to', newValue);
                return newValue;
              });
            }
          } else {
            console.log('⚠️ Failed to uncomplete via API, falling back to local toggle');
            // Fallback to local toggle if API fails
            setTasks(prevTasks => prevTasks.map(t =>
              t.id === task.id
                ? { ...t, completed: false }
                : t
            ));

            // Reverse stat changes for local toggle
            if (task.reward) {
              const reverseReward = task.reward.replace(/\+/g, '-');
              applyStatChanges(reverseReward);
              console.log('📉 Reversed stat changes locally:', reverseReward);
            }
          }
        }
      } else {
        // Use regular task completion API for database tasks
        const response = await fetch(API_ENDPOINTS.taskComplete, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task_id: task.id,
            user: currentUser || 'tester'
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📡 Backend response:', data);

          if (data.success) {
            // Update local task state to reflect the change
            setTasks(prevTasks => prevTasks.map(t =>
              t.id === task.id
                ? { ...t, completed: data.task_completed }
                : t
            ));

            // Apply stat changes based on task completion status using context function
            if (data.task_completed && task.reward) {
              // Task completed: apply positive stat changes
              applyStatChanges(task.reward);
              console.log('📈 Applied stat changes:', task.reward);
            } else if (!data.task_completed && task.reward) {
              // Task uncompleted: reverse the stat changes
              const reverseReward = task.reward.replace(/\+/g, '-');
              applyStatChanges(reverseReward);
              console.log('📉 Reversed stat changes:', reverseReward);
            }

            // Check for level up from API response (only when completing task)
            if (data.task_completed && data.user_stats && data.user_stats.level_up) {
              console.log('🎉 Level up detected!', data.user_stats);
              const oldStage = getAvatarStage(data.user_stats.old_level);
              const newStage = getAvatarStage(data.user_stats.level);

              setLevelUpData({
                oldLevel: data.user_stats.old_level,
                newLevel: data.user_stats.level,
                newExp: data.user_stats.exp,
                oldStage,
                newStage
              });
              setShowLevelUpModal(true);
            }

            // Update user stats with level and EXP data
            if (data.user_stats) {
              updateUserStats({
                currentStreak: data.streak,
                level: data.user_stats.level,
                exp: data.user_stats.exp
              });

              // Update user state for display
              setUser(prev => ({
                ...prev,
                level: data.user_stats.level,
                exp: data.user_stats.exp,
                streak: data.streak
              }));
            } else {
              updateUserStats({ currentStreak: data.streak });

              // Update user state with streak only
              setUser(prev => ({
                ...prev,
                streak: data.streak
              }));
            }

            console.log('✅ Task toggle successful, refreshing weekly stats');

            // Immediately refresh weekly stats after task completion/uncompletion
            setRefreshTrigger(prev => {
              const newValue = prev + 1;
              console.log('🔄 Weekly stats refresh: incrementing from', prev, 'to', newValue);
              return newValue;
            });
          } else {
            console.error('Task completion failed');
          }
        } else {
          console.error('Failed to complete task');
        }
      }
    } catch (err) {
      console.error('Error completing task:', err);

      // Fallback to local stat changes if API fails
      if (task.reward) {
        applyStatChanges(task.reward);
        console.log('📈 Applied fallback stat changes:', task.reward);

        // Still refresh weekly stats on fallback
        setRefreshTrigger(prev => prev + 1);
      }
    }
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

      const url = `${API_ENDPOINTS.tasks}?user=${currentUser || 'tester'}`;
      console.log('Fetching tasks from:', url);
      const { data } = await apiRequest(url);
      console.log('All tasks fetched:', data);

      // Select 3 random daily tasks from the full list
      const selectedTasks = selectDailyTasks(data);
      setTasks(selectedTasks);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      // Set default tasks if API fails - enhanced rewards (1-10 points)
      const fallbackTasks = [
        {id: 1, title: "🧹 Organise workspace", tip: "Clean and organise your desk", reward: "+6 Discipline, +8 Wellness, +2 Energy", completed: false, difficulty: 1, attribute: "discipline"},
        {id: 2, title: "📝 Write journal entry", tip: "Reflect on today's experiences", reward: "+5 Discipline, +7 Wellness, +3 Intelligence", completed: false, difficulty: 1, attribute: "discipline"},
        {id: 3, title: "🏃‍♂️ 30-minute workout", tip: "Include cardio and strength training", reward: "+9 Energy, +6 Discipline, +8 Wellness", completed: false, difficulty: 2, attribute: "energy"},
        {id: 4, title: "💻 Practice coding", tip: "Solve a Leetcode problem", reward: "+8 Intelligence, +5 Discipline, +2 Wellness", completed: false, difficulty: 2, attribute: "intelligence"},
        {id: 5, title: "🧘‍♀️ Meditation", tip: "10 minutes of mindfulness", reward: "+4 Energy, +6 Discipline, +10 Wellness, -3 Stress", completed: false, difficulty: 1, attribute: "energy"},
        {id: 6, title: "📚 Learn something new", tip: "Read an educational article", reward: "+7 Intelligence, +4 Discipline, +3 Wellness", completed: false, difficulty: 1, attribute: "intelligence"}
      ];
      const selectedTasks = selectDailyTasks(fallbackTasks);
      setTasks(selectedTasks);
      setError(null); // Don't show error if we have fallback data
    } finally {
      if (!preventScroll) {
        setLoading(false);
      }
    }
  }, []); // Remove currentUser dependency

  const fetchUserStats = useCallback(async () => {
    console.log('fetchUserStats called, currentUser:', currentUser);
    try {
      const url = `${API_ENDPOINTS.userStats}?user=${currentUser || 'tester'}`;
      console.log('Fetching user stats from:', url);
      const { data } = await apiRequest(url);
      console.log('User stats fetched successfully:', data);

      setLocalUserStats(data);
      updateUserStats({
        level: data.level,
        currentStreak: data.current_streak,
        exp: data.exp
      });

      // Update user state with latest data
      setUser(prev => ({
        ...prev,
        level: data.level,
        exp: data.exp || 0,
        streak: data.current_streak
      }));
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
      // Set default user stats if API fails
      setLocalUserStats({
        level: 5,
        current_streak: 3,
        total_tasks_completed: 25,
        total_score: 1250,
        exp: 0
      });
      // Update user state with defaults
      setUser(prev => ({
        ...prev,
        level: 5,
        exp: 0,
        streak: 3
      }));
    }
  }, []); // Remove dependencies

  // Initialize data on component mount only once
  useEffect(() => {
    console.log('Homepage useEffect running, about to fetch data');
    fetchTasks();
    fetchUserStats();
  }, []); // Only run once on mount

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
          <UserProfileCard user={user} userStats={localUserStats} />
        </div>

        {/* Main Goal */}
        <MainGoal currentUser={currentUser} />

        {/* Weekly Stats Component */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <WeeklyTaskStats currentUser={currentUser} refreshTrigger={refreshTrigger} />
        </div>

        {/* Stats Panel */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <StatsPanel stats={attributeStats} />
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
              🎲 New Daily Random Tasks
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

        {/* Level Up Modal */}
        <LevelUpModal
          isOpen={showLevelUpModal}
          onClose={() => setShowLevelUpModal(false)}
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          newExp={levelUpData.newExp}
          oldStage={levelUpData.oldStage}
          newStage={levelUpData.newStage}
        />
      </div>
    </div>
  );
}
