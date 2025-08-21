import { useState, useEffect, createContext, useContext } from 'react';
import { debugLog } from '../utils/logger';

// Create the context
export const AppContext = createContext();

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// Provider component
export function AppProvider({ children }) {
  // User state
  const [currentUser, setCurrentUser] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
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

  // Demo user data for guest mode
  const [demoUser, setDemoUser] = useState({
    username: 'Guest Demo',
    level: 3,
    currentStreak: 4,
    maxStreak: 7,
    todayTasksCompleted: 2,
    weeklyTasksCompleted: 8,
    totalPoints: {
      intelligence: 120,
      discipline: 85,
      energy: 95,
      social: 110,
      wellness: 100,
      stress: 25
    }
  });

  // Guest mode tasks state (persisted across page navigation)
  const [guestTasks, setGuestTasks] = useState([]);

  // Initialize user state from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    const savedGuestMode = localStorage.getItem('isGuestMode');

    if (savedUser) {
      setCurrentUser(savedUser);
      // Load user data when user is found
      loadUserData(savedUser);
    } else if (savedGuestMode === 'true') {
      setIsGuestMode(true);
      setCurrentUser('Guest');

      // Load guest mode data from localStorage
      const savedGuestData = localStorage.getItem('guestModeData');
      if (savedGuestData) {
        try {
          const guestData = JSON.parse(savedGuestData);
          if (guestData.demoUser) setDemoUser(guestData.demoUser);
          if (guestData.guestTasks) setGuestTasks(guestData.guestTasks);
          if (guestData.attributeStats) setAttributeStats(guestData.attributeStats);
        } catch (error) {
          console.error('Error loading guest mode data:', error);
        }
      }
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
    setIsGuestMode(false);
    localStorage.setItem('currentUser', username);
    localStorage.removeItem('isGuestMode');
    loadUserData(username);
  };

  const handleGuestMode = () => {
    setCurrentUser('Guest');
    setIsGuestMode(true);
    localStorage.setItem('isGuestMode', 'true');
    localStorage.removeItem('currentUser');
    // Set some demo data for guest mode
    setUserStats({
      level: 3,
      currentStreak: 2,
      maxStreak: 5,
      totalPoints: {
        intelligence: 25,
        discipline: 18,
        energy: 32,
        social: 15,
        wellness: 28,
        stress: 8
      }
    });
    setAttributeStats({
      intelligence: 75,
      discipline: 60,
      energy: 85,
      social: 70,
      wellness: 80,
      stress: 30
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsGuestMode(false);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isGuestMode');
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

      // Save attribute stats changes in guest mode
      if (isGuestMode) {
        saveGuestModeData({ attributeStats: newStats });
      }

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

  // Function to update demo user stats for guest mode
  const updateDemoUser = (updates) => {
    setDemoUser(prev => {
      const newDemoUser = {
        ...prev,
        ...updates
      };
      // Save to localStorage when in guest mode
      saveGuestModeData({ demoUser: newDemoUser });
      return newDemoUser;
    });
  };

  // Function to update guest tasks and persist them
  const updateGuestTasks = (newTasks) => {
    setGuestTasks(newTasks);
    saveGuestModeData({ guestTasks: newTasks });
  };

  // Function to save guest mode data to localStorage
  const saveGuestModeData = (updates) => {
    if (!isGuestMode) return;

    try {
      const existingData = localStorage.getItem('guestModeData');
      const currentData = existingData ? JSON.parse(existingData) : {};

      const updatedData = {
        ...currentData,
        ...updates,
        timestamp: Date.now()
      };

      localStorage.setItem('guestModeData', JSON.stringify(updatedData));
    } catch (error) {
      console.error('Error saving guest mode data:', error);
    }
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
    isGuestMode,
    isLoading,
    setIsLoading,
    demoUser,
    updateDemoUser,

    // Guest mode functions
    guestTasks,
    updateGuestTasks,
    saveGuestModeData,

    // Auth functions
    handleLoginSuccess,
    handleGuestMode,
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
