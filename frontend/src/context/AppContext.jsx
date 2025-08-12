import { useState, useEffect } from 'react';
import { debugLog } from '../utils/logger';
import { AppContext } from './context';

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
      stress: 0
    }
  });

  // Attribute stats for display (these are the bars in HomePage)
  const [attributeStats, setAttributeStats] = useState({
    intelligence: 75,
    discipline: 60,
    energy: 85,
    social: 70,
    wellness: 80,
    stress: 30
  });

  // Goal state (shared across HomePage)
  const [userGoal, setUserGoal] = useState(null);

  // Initialize user state from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
      // Load user data when user is found
      loadUserData(savedUser);
    }
    setIsLoading(false);
  }, []);

  const loadUserData = async (username) => {
    try {
      // Load user stats, tasks, and goal when user logs in
      // This prevents data from being reset on page navigation
      debugLog('Loading user data for:', username);

      // Data is loaded individually by each component as needed
      // This function serves as a placeholder for future centralized data loading
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLoginSuccess = (username) => {
    setCurrentUser(username);
    localStorage.setItem('currentUser', username);
    loadUserData(username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    // Reset all state
    setTasks([]);
    setCompletedTasks([]);
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
        stress: 0
      }
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
    setUserStats(prev => ({ ...prev, ...newStats }));
  };

  const updateAttributeStats = (newAttributeStats) => {
    setAttributeStats(prev => ({ ...prev, ...newAttributeStats }));
  };

  // Function to apply stat changes from completing tasks
  const applyStatChanges = (changeString) => {
    // Parse change strings like "+3 Intelligence, +2 Discipline" or "-1 Energy, -1 Intelligence"
    const changes = changeString.split(',').map(change => change.trim());

    setAttributeStats(prevStats => {
      const newStats = { ...prevStats };

      changes.forEach(change => {
        const match = change.match(/([+-]\d+)\s+(\w+)/i);
        if (match) {
          const [, valueStr, statName] = match;
          const value = parseInt(valueStr);
          const statKey = statName.toLowerCase();

          if (Object.prototype.hasOwnProperty.call(newStats, statKey)) {
            // Set max limit for stress to 100, others to 1000
            const maxLimit = statKey === 'stress' ? 100 : 1000;
            newStats[statKey] = Math.max(0, Math.min(maxLimit, newStats[statKey] + value));
            debugLog(`📊 Updated ${statKey}: ${prevStats[statKey]} → ${newStats[statKey]} (${value > 0 ? '+' : ''}${value})`);
          }
        }
      });

      return newStats;
    });

    // Also update total points for the specific attributes
    changes.forEach(change => {
      const match = change.match(/([+-]\d+)\s+(\w+)/i);
      if (match) {
        const [, valueStr, statName] = match;
        const value = parseInt(valueStr);
        const statKey = statName.toLowerCase();

        if (userStats.totalPoints[statKey] !== undefined) {
          setUserStats(prev => ({
            ...prev,
            totalPoints: {
              ...prev.totalPoints,
              [statKey]: Math.max(0, prev.totalPoints[statKey] + value)
            }
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
      .filter(task => task.attribute === attribute)
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
    loadUserData
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
