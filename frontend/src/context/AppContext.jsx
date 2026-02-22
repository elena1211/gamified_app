import { useState, useEffect, createContext, useContext } from "react";
import { debugLog } from "../utils/logger";
import { apiRequest, API_ENDPOINTS } from "../config/api";

// Create the context
export const AppContext = createContext();

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

// Provider component
export function AppProvider({ children }) {
  // User state
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tasks state (shared across TaskManagerPage)
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);

  // User stats state (shared across all pages)
  const [userStats, setUserStats] = useState({
    level: 1,
    currentStreak: 0,
    maxStreak: 0,
    totalPoints: {
      intelligence: 0,
      discipline: 0,
      energy: 0,
      social: 0,
      wellness: 0,
      stress: 0,
    },
  });

  // Attribute stats for display (these are the bars in HomePage)
  // Loaded from localStorage so they survive page navigation and refresh
  const getInitialAttributeStats = () => {
    try {
      const saved = localStorage.getItem("levelup_attributeStats");
      if (saved) {
        const parsed = JSON.parse(saved);
        debugLog("📦 Loaded attributeStats from localStorage:", parsed);
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse saved attributeStats:", e);
    }
    return {
      intelligence: 0,
      discipline: 0,
      energy: 0,
      social: 0,
      wellness: 0,
      stress: 0,
    };
  };

  const [attributeStats, setAttributeStats] = useState(
    getInitialAttributeStats,
  );

  // Persist attributeStats to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "levelup_attributeStats",
        JSON.stringify(attributeStats),
      );
    } catch (e) {
      console.error("Failed to save attributeStats to localStorage:", e);
    }
  }, [attributeStats]);

  // Goal state (shared across HomePage)
  const [userGoal, setUserGoal] = useState(null);

  const loadUserData = async (username) => {
    try {
      debugLog("Loading user data for:", username);
      const { data } = await apiRequest(
        `${API_ENDPOINTS.userStats}?user=${username}`,
      );

      // Merge DB attribute values with localStorage — keep the higher value
      // (protects against Render cold-starts returning stale zeros)
      if (data.attributes && Object.keys(data.attributes).length > 0) {
        setAttributeStats((prev) => {
          const merged = { ...prev };
          Object.keys(data.attributes).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(merged, key)) {
              merged[key] = Math.max(
                merged[key] || 0,
                data.attributes[key] || 0,
              );
            }
          });
          debugLog(
            "📊 loadUserData: DB attrs",
            data.attributes,
            "→ merged",
            merged,
          );
          return merged;
        });
      }

      // Load level / exp / streak from DB
      if (data.level !== undefined) {
        setUserStats((prev) => ({
          ...prev,
          level: data.level,
          currentStreak: data.current_streak || 0,
          exp: data.exp || 0,
        }));
      }
    } catch (error) {
      debugLog(
        "loadUserData: API unavailable, using cached values:",
        error.message,
      );
    }
  };

  // Initialize user state from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      setCurrentUser(savedUser);
      loadUserData(savedUser);
    }
    setIsLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoginSuccess = (username) => {
    setCurrentUser(username);
    localStorage.setItem("currentUser", username);
    loadUserData(username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("levelup_attributeStats");
    // Reset all state
    setTasks([]);
    setCompletedTasks([]);
    setAttributeStats({
      intelligence: 0,
      discipline: 0,
      energy: 0,
      social: 0,
      wellness: 0,
      stress: 0,
    });
    setUserStats({
      level: 1,
      currentStreak: 0,
      maxStreak: 0,
      totalPoints: {
        intelligence: 0,
        discipline: 0,
        energy: 0,
        social: 0,
        wellness: 0,
        stress: 0,
      },
    });
    setUserGoal(null);
  };

  const updateTasksState = (newTasks) => {
    setTasks(newTasks);
  };

  const updateCompletedTasksState = (newCompletedTasks) => {
    setCompletedTasks(newCompletedTasks);
  };

  const updateUserStats = (newStats) => {
    setUserStats((prev) => ({ ...prev, ...newStats }));
  };

  const updateAttributeStats = (newAttributeStats) => {
    setAttributeStats((prev) => ({ ...prev, ...newAttributeStats }));
  };

  // Function to apply stat changes from completing tasks
  const applyStatChanges = (changeString) => {
    // Parse change strings like "+3 Intelligence, +2 Discipline" or "-1 Energy, -1 Intelligence"
    const changes = changeString.split(",").map((change) => change.trim());

    setAttributeStats((prevStats) => {
      const newStats = { ...prevStats };

      changes.forEach((change) => {
        const match = change.match(/([+-]\d+)\s+(\w+)/i);
        if (match) {
          const [, valueStr, statName] = match;
          const value = parseInt(valueStr);
          const statKey = statName.toLowerCase();

          if (Object.prototype.hasOwnProperty.call(newStats, statKey)) {
            // Set max limit for stress to 100, others to 1000
            const maxLimit = statKey === "stress" ? 100 : 1000;
            newStats[statKey] = Math.max(
              0,
              Math.min(maxLimit, newStats[statKey] + value),
            );
            debugLog(
              `📊 Updated ${statKey}: ${prevStats[statKey]} → ${newStats[statKey]} (${value > 0 ? "+" : ""}${value})`,
            );
          }
        }
      });

      return newStats;
    });

    // Also update total points for the specific attributes
    changes.forEach((change) => {
      const match = change.match(/([+-]\d+)\s+(\w+)/i);
      if (match) {
        const [, valueStr, statName] = match;
        const value = parseInt(valueStr);
        const statKey = statName.toLowerCase();

        if (userStats.totalPoints[statKey] !== undefined) {
          setUserStats((prev) => ({
            ...prev,
            totalPoints: {
              ...prev.totalPoints,
              [statKey]: Math.max(0, prev.totalPoints[statKey] + value),
            },
          }));
        }
      }
    });
  };

  const updateUserGoal = (newGoal) => {
    setUserGoal(newGoal);
  };

  // Calculate total points for a specific attribute
  const getAttributePoints = (attribute) => {
    return completedTasks
      .filter((task) => task.attribute === attribute)
      .reduce((sum, task) => sum + parseInt(task.reward_point || 0), 0);
  };

  const value = {
    // User state
    currentUser,
    isLoading,
    setIsLoading,

    // Auth functions
    handleLoginSuccess,
    handleLogout,

    // Tasks state and functions
    tasks,
    completedTasks,
    updateTasksState,
    updateCompletedTasksState,

    // User stats
    userStats,
    updateUserStats,

    // Attribute stats (for HomePage display)
    attributeStats,
    updateAttributeStats,
    applyStatChanges,

    // Utility functions
    getAttributePoints,

    // Goal state
    userGoal,
    updateUserGoal,

    // Utility functions
    loadUserData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
