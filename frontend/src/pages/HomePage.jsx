import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS, apiRequest } from "../config/api.js";
import BottomNav from "../components/BottomNav";
import StatsPanel from "../components/StatsPanel";
import UserProfileCard from "../components/UserProfileCard";
import TaskList from "../components/TaskList";
import MainGoal from "../components/MainGoal";
import TimeLimitedTaskPopup from "../components/TimeLimitedTaskPopup";
import Modal from "../components/Modal";
import WeeklyTaskStats from "../components/WeeklyTaskStats";
import LevelUpModal from "../components/LevelUpModal";
import { useAppContext } from "../context/AppContext";
import { getAvatarStage } from "../utils/avatar";
import { debugLog } from "../utils/logger";

// Time-limited ultra-micro engineering actions - Atomic habit style (5-10 seconds)
const TIME_LIMITED_TASKS = [
  {
    title: "Click VS Code Tab",
    description:
      "Simply click on your VS Code tab or open VS Code if not running",
    duration: 10,
    reward: "+3 Intelligence, +2 Discipline",
    penalty: "-1 Intelligence",
  },
  {
    title: "Press Ctrl+S",
    description: "Save any file you have open with Ctrl+S (or Cmd+S on Mac)",
    duration: 5,
    reward: "+2 Discipline, +1 Intelligence",
    penalty: "-1 Discipline",
  },
  {
    title: "Check Git Status",
    description: "Type 'git status' in terminal and press Enter",
    duration: 8,
    reward: "+4 Intelligence, +3 Discipline",
    penalty: "-2 Intelligence",
  },
  {
    title: "Open Terminal",
    description: "Open your terminal or command prompt application",
    duration: 7,
    reward: "+3 Intelligence, +2 Discipline",
    penalty: "-1 Intelligence",
  },
  {
    title: "Create New File",
    description: "Press Ctrl+N (or Cmd+N) to create a new file in your editor",
    duration: 6,
    reward: "+2 Intelligence, +3 Discipline",
    penalty: "-1 Discipline",
  },
  {
    title: "Code Review Check",
    description: "Review one function or method in your current codebase",
    duration: 9,
    reward: "+4 Intelligence, +2 Discipline",
    penalty: "-2 Intelligence",
  },
  {
    title: "Open Browser Dev Tools",
    description:
      "Press F12 or right-click and select 'Inspect' in your browser",
    duration: 8,
    reward: "+5 Intelligence, +2 Discipline",
    penalty: "-2 Intelligence",
  },
  {
    title: "Navigate to GitHub",
    description: "Type 'github.com' in your browser address bar",
    duration: 7,
    reward: "+3 Intelligence, +2 Social",
    penalty: "-1 Intelligence",
  },
];

export default function HomePage({
  currentUser,
  onNavigateToSettings,
  onNavigateToTaskManager,
}) {
  debugLog("HomePage component starting to render, currentUser:", currentUser);

  // Use global state from context
  const { attributeStats, applyStatChanges, updateUserStats } = useAppContext();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeLimitedTask, setShowTimeLimitedTask] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState("");
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger for weekly stats

  // Level up modal states
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState({
    oldLevel: 0,
    newLevel: 0,
    newExp: 0,
    oldStage: 1,
    newStage: 1,
  });

  // Time-limited task data
  const [currentTimeLimitedTask, setCurrentTimeLimitedTask] = useState(null);
  const [lastDismissedTask, setLastDismissedTask] = useState(null);
  const [questSchedulerActive, setQuestSchedulerActive] = useState(false);

  const [user, setUser] = useState({
    name: currentUser || "tester",
    level: 1, // Will be updated from API
    exp: 0, // Will be updated from API
    streak: 0, // Will be updated from API
    avatar:
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxMDAiIGZpbGw9IiNmYzkxYmYiLz4KPGNpcmNsZSBjeD0iMTAwIiBjeT0iODAiIHI9IjMwIiBmaWxsPSIjZmZmZmZmIi8+CjxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNTAiIHJ4PSI0MCIgcnk9IjMwIiBmaWxsPSIjZmZmZmZmIi8+Cjwvc3ZnPgo=",
  });

  const [localUserStats, setLocalUserStats] = useState(null);

  const handleAcceptTask = async () => {
    if (currentTimeLimitedTask) {
      try {
        // Call dynamic task completion API for time-limited tasks
        const response = await fetch(API_ENDPOINTS.dynamicTaskComplete, {
          method: "POST",
          mode: "cors", // Use CORS mode for cross-origin requests
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task_title: currentTimeLimitedTask.title,
            task_type: "time_limited",
            reward_points: parseInt(
              currentTimeLimitedTask.reward.match(/\+(\d+)/)?.[1] || "1",
            ),
            attribute: "discipline", // Default attribute for time-limited tasks
            user: currentUser || "tester",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          debugLog("📡 Time-limited task completion response:", data);

          if (data.success) {
            // Apply stat changes
            applyStatChanges(currentTimeLimitedTask.reward);

            // Check for level up from API response
            if (data.user_stats && data.user_stats.level_up) {
              debugLog(
                "🎉 Level up detected from time-limited task!",
                data.user_stats,
              );
              const oldStage = getAvatarStage(data.user_stats.old_level);
              const newStage = getAvatarStage(data.user_stats.level);

              setLevelUpData({
                oldLevel: data.user_stats.old_level,
                newLevel: data.user_stats.level,
                newExp: data.user_stats.exp,
                oldStage,
                newStage,
              });
              setShowLevelUpModal(true);
            }

            // Update user stats with level and EXP data
            if (data.user_stats) {
              updateUserStats({
                currentStreak: data.streak,
                level: data.user_stats.level,
                exp: data.user_stats.exp,
              });

              // Update user state for display
              setUser((prev) => ({
                ...prev,
                level: data.user_stats.level,
                exp: data.user_stats.exp,
                streak: data.streak,
              }));
            } else {
              updateUserStats({ currentStreak: data.streak });

              // Update user state with streak only
              setUser((prev) => ({
                ...prev,
                streak: data.streak,
              }));
            }

            debugLog(
              "✅ Time-limited task completed, refreshing weekly stats in 0.3s",
            );

            // Refresh weekly stats after time-limited task completion
            setTimeout(() => {
              setRefreshTrigger((prev) => prev + 1);
              debugLog(
                "🔄 Weekly stats refresh triggered for time-limited task",
              );
            }, 300);
          }
        }
      } catch (error) {
        console.error("Error completing time-limited task:", error);
        // Fallback to local changes
        applyStatChanges(currentTimeLimitedTask.reward);
        setRefreshTrigger((prev) => prev + 1);
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
    setWarningType("rejection");
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
    setWarningType("timeout");
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
    const willComplete = !task.completed;

    // === OPTIMISTIC UPDATE — instant UI response, no waiting for API ===
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: willComplete } : t,
      ),
    );
    if (task.reward) {
      // Apply or reverse stat changes immediately so the stats panel reacts at once
      willComplete
        ? applyStatChanges(task.reward)
        : applyStatChanges(task.reward.replace(/\+/g, "-"));
    }

    try {
      debugLog(
        "🎯 Task toggle:",
        task.title,
        "→",
        willComplete ? "complete" : "incomplete",
      );

      let data = null;

      if (willComplete) {
        // Complete: use dynamicTaskComplete which saves attribute changes to DB
        const res = await fetch(API_ENDPOINTS.dynamicTaskComplete, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_title: task.title,
            task_type: "daily",
            reward_points: parseInt(task.reward?.match(/\+(\d+)/)?.[1] || "1"),
            reward_string: task.reward || "",
            attribute: task.attribute || "discipline",
            user: currentUser || "tester",
          }),
        });
        if (res.ok) data = await res.json();
      } else {
        // Uncomplete: use dynamicTaskUncomplete which reverses attribute changes in DB
        const res = await fetch(API_ENDPOINTS.dynamicTaskUncomplete, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_title: task.title,
            reward_string: task.reward || "",
            user: currentUser || "tester",
          }),
        });
        if (res.ok) data = await res.json();
      }

      // Update level / streak / EXP from API response
      if (data?.user_stats) {
        if (data.user_stats.level_up) {
          setLevelUpData({
            oldLevel: data.user_stats.old_level,
            newLevel: data.user_stats.level,
            newExp: data.user_stats.exp,
            oldStage: getAvatarStage(data.user_stats.old_level),
            newStage: getAvatarStage(data.user_stats.level),
          });
          setShowLevelUpModal(true);
        }
        updateUserStats({
          currentStreak: data.streak,
          level: data.user_stats.level,
          exp: data.user_stats.exp,
        });
        setUser((prev) => ({
          ...prev,
          level: data.user_stats.level,
          exp: data.user_stats.exp,
          streak: data.streak,
        }));
      } else if (data?.streak !== undefined) {
        updateUserStats({ currentStreak: data.streak });
        setUser((prev) => ({ ...prev, streak: data.streak }));
      }

      // Refresh weekly stats panel
      setTimeout(() => setRefreshTrigger((prev) => prev + 1), 300);
    } catch (err) {
      console.error("Error completing task:", err);
      // Optimistic changes already applied — keep them, don't revert
    }
  };

  // Helper function to randomly select 3 balanced daily tasks
  const selectDailyTasks = (allTasks) => {
    if (allTasks.length <= 3) {
      return allTasks;
    }

    // Group tasks by difficulty for balanced selection
    const tasksByDifficulty = {
      1: allTasks.filter((task) => task.difficulty === 1),
      2: allTasks.filter((task) => task.difficulty === 2),
      3: allTasks.filter((task) => task.difficulty === 3 || !task.difficulty),
    };

    const selectedTasks = [];

    // Try to get one task from each difficulty level
    for (let difficulty = 1; difficulty <= 3; difficulty++) {
      const tasksInDifficulty = tasksByDifficulty[difficulty];
      if (tasksInDifficulty.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * tasksInDifficulty.length,
        );
        selectedTasks.push(tasksInDifficulty[randomIndex]);
      }
    }

    // If we still need more tasks, randomly pick from remaining tasks
    while (selectedTasks.length < 3 && selectedTasks.length < allTasks.length) {
      const remainingTasks = allTasks.filter(
        (task) => !selectedTasks.some((selected) => selected.id === task.id),
      );

      if (remainingTasks.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingTasks.length);
        selectedTasks.push(remainingTasks[randomIndex]);
      } else {
        break;
      }
    }

    debugLog("🎲 Selected daily tasks:", selectedTasks);
    return selectedTasks;
  };

  const fetchTasks = useCallback(
    async (preventScroll = false) => {
      debugLog("fetchTasks called, currentUser:", currentUser);
      try {
        if (!preventScroll) {
          setLoading(true);
        }

        const url = `${API_ENDPOINTS.tasks}?user=${currentUser || "tester"}`;
        debugLog("Fetching tasks from:", url);
        const { data } = await apiRequest(url);
        debugLog("All tasks fetched:", data);

        // Check if we got real API data or if it's empty/invalid
        if (!data || !Array.isArray(data) || data.length === 0) {
          debugLog("⚠️ No valid tasks from API, using fallback tasks");
          throw new Error("No tasks returned from API");
        }

        // Pre-validate: drop tasks whose titles are purely numeric or still carry
        // a timestamp suffix — the same criteria TaskList would filter out anyway
        const validData = data.filter((task) => {
          if (!task.title || task.title.trim() === "") return false;
          const clean = task.title.replace(/ - \d{2}:\d{2}:\d{2}$/, "").trim();
          return clean.length > 0 && !/^\d+$/.test(clean);
        });
        if (validData.length === 0) {
          debugLog("⚠️ All API tasks had invalid titles, using fallback");
          throw new Error("No valid tasks from API");
        }

        // Select 3 random daily tasks from the full list
        const selectedTasks = selectDailyTasks(validData);
        setTasks(selectedTasks);
        setError(null);
        debugLog("✅ Successfully loaded tasks from API:", selectedTasks);
        debugLog(
          "📋 Task titles:",
          selectedTasks.map((t) => ({ id: t.id, title: t.title })),
        );
      } catch (err) {
        console.error("Error fetching tasks:", err);
        debugLog("⚠️ API failed, loading fallback tasks...");
        // Set default tasks if API fails - enhanced rewards (1-10 points)
        const fallbackTasks = [
          {
            id: 101,
            title: "🧹 Organise workspace",
            tip: "Clean and organise your desk",
            reward: "+6 Discipline, +8 Wellness, +2 Energy",
            completed: false,
            difficulty: 1,
            attribute: "discipline",
          },
          {
            id: 102,
            title: "📝 Write journal entry",
            tip: "Reflect on today's experiences",
            reward: "+5 Discipline, +7 Wellness, +3 Intelligence",
            completed: false,
            difficulty: 1,
            attribute: "discipline",
          },
          {
            id: 103,
            title: "🏃‍♂️ 30-minute workout",
            tip: "Include cardio and strength training",
            reward: "+9 Energy, +6 Discipline, +8 Wellness",
            completed: false,
            difficulty: 2,
            attribute: "energy",
          },
          {
            id: 104,
            title: "💻 Practice coding",
            tip: "Solve a Leetcode problem",
            reward: "+8 Intelligence, +5 Discipline, +2 Wellness",
            completed: false,
            difficulty: 2,
            attribute: "intelligence",
          },
          {
            id: 105,
            title: "🧘‍♀️ Meditation",
            tip: "10 minutes of mindfulness",
            reward: "+4 Energy, +6 Discipline, +10 Wellness, -3 Stress",
            completed: false,
            difficulty: 1,
            attribute: "energy",
          },
          {
            id: 106,
            title: "📚 Learn something new",
            tip: "Read an educational article",
            reward: "+7 Intelligence, +4 Discipline, +3 Wellness",
            completed: false,
            difficulty: 1,
            attribute: "intelligence",
          },
        ];
        const selectedTasks = selectDailyTasks(fallbackTasks);
        setTasks(selectedTasks);
        setError(null); // Don't show error if we have fallback data
        debugLog("📋 Fallback tasks loaded:", selectedTasks);
      } finally {
        if (!preventScroll) {
          setLoading(false);
        }
      }
    },
    [currentUser],
  ); // Include currentUser dependency

  const fetchUserStats = useCallback(async () => {
    debugLog("fetchUserStats called, currentUser:", currentUser);
    try {
      const url = `${API_ENDPOINTS.userStats}?user=${currentUser || "tester"}`;
      debugLog("Fetching user stats from:", url);
      const { data } = await apiRequest(url);
      debugLog("User stats fetched successfully:", data);

      setLocalUserStats(data);
      updateUserStats({
        level: data.level,
        currentStreak: data.current_streak,
        exp: data.exp,
      });

      // NOTE: attribute stats are managed by AppContext (loaded once on login
      // and persisted in localStorage). Do NOT overwrite them here on every
      // navigation — that would reset in-session progress to whatever the DB has.

      // Update user state with latest data
      setUser((prev) => ({
        ...prev,
        level: data.level,
        exp: data.exp || 0,
        streak: data.current_streak,
      }));
    } catch (err) {
      console.error("Failed to fetch user stats:", err);
      // Set default user stats if API fails
      setLocalUserStats({
        level: 5,
        current_streak: 3,
        total_tasks_completed: 25,
        total_score: 1250,
        exp: 0,
      });
      // Update user state with defaults
      setUser((prev) => ({
        ...prev,
        level: 5,
        exp: 0,
        streak: 3,
      }));
    }
  }, [currentUser, updateUserStats]); // Include dependencies

  // Initialize data on component mount only once
  useEffect(() => {
    debugLog("Homepage useEffect running, about to fetch data");
    fetchTasks();
    fetchUserStats();
  }, [currentUser]); // Only depend on currentUser, not the functions

  // Random time-limited task system - appears at random intervals
  useEffect(() => {
    // Don't start multiple schedulers
    if (questSchedulerActive) return;

    setQuestSchedulerActive(true);

    const scheduleNextTimeLimitedTask = () => {
      // Random interval between 30 seconds - 2 minutes (30000-120000ms) for better UX
      const randomDelay = Math.random() * (120000 - 30000) + 30000;

      debugLog(
        `⏰ Next time-limited quest scheduled in ${Math.round(randomDelay / 1000)} seconds`,
      );

      const timer = setTimeout(() => {
        // Only show if no task is currently active
        if (!showTimeLimitedTask && !currentTimeLimitedTask) {
          const randomTask =
            TIME_LIMITED_TASKS[
              Math.floor(Math.random() * TIME_LIMITED_TASKS.length)
            ];
          debugLog(
            "⚡ Triggering random time-limited quest:",
            randomTask.title,
          );

          setCurrentTimeLimitedTask(randomTask);
          setShowTimeLimitedTask(true);
        }

        // Schedule the next task
        scheduleNextTimeLimitedTask();
      }, randomDelay);

      return timer;
    };

    // Start the first scheduled task with initial delay (10-15 seconds after page load)
    const initialDelay = Math.random() * (15000 - 10000) + 10000;
    debugLog(
      `🎮 Time-limited quest system starting, first quest in ${Math.round(initialDelay / 1000)} seconds`,
    );

    const initialTimer = setTimeout(() => {
      if (!showTimeLimitedTask && !currentTimeLimitedTask) {
        const randomTask =
          TIME_LIMITED_TASKS[
            Math.floor(Math.random() * TIME_LIMITED_TASKS.length)
          ];
        debugLog("⚡ Triggering initial time-limited quest:", randomTask.title);

        setCurrentTimeLimitedTask(randomTask);
        setShowTimeLimitedTask(true);
      }

      // Start the recurring schedule
      scheduleNextTimeLimitedTask();
    }, initialDelay);

    return () => {
      clearTimeout(initialTimer);
      setQuestSchedulerActive(false);
    };
  }, []); // Only run once on mount

  debugLog("Homepage about to render, loading:", loading, "error:", error);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
        <div className="text-purple-800 text-xl">
          🎮 Loading your adventure...
        </div>
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
          <WeeklyTaskStats
            currentUser={currentUser}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Stats Panel */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <StatsPanel stats={attributeStats} />
        </div>
        {/* Task List */}
        <div className="bg-white rounded-2xl p-8 shadow-md">
          <TaskList tasks={tasks} onTaskComplete={handleTaskComplete} />
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
          </div>
        </div>
        <BottomNav
          onSettingsClick={handleSettingsClick}
          onTaskManagerClick={handleTaskManagerClick}
        />

        {/* Popups */}
        {showTimeLimitedTask && currentTimeLimitedTask && (
          <div style={{ position: "relative", zIndex: 9999 }}>
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
            title={
              warningType === "rejection" ? "Quest Dismissed!" : "Time's Up!"
            }
            message={
              warningType === "rejection"
                ? "You chose to avoid the challenge..."
                : "The quest time has ended..."
            }
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
