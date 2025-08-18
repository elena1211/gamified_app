// API configuration and helper functions
import { debugLog } from '../utils/logger';

// Environment-based API configuration
const API_BASE = import.meta.env.VITE_API_URL || 'https://web-production-d27fa.up.railway.app/api';

export const API_ENDPOINTS = {
  // Authentication
  login: `${API_BASE}/login/`,
  register: `${API_BASE}/register/`,

  // Tasks
  tasks: `${API_BASE}/tasks/`,
  taskComplete: `${API_BASE}/tasks/complete/`,
  dynamicTaskComplete: `${API_BASE}/tasks/complete-dynamic/`,
  dynamicTaskUncomplete: `${API_BASE}/tasks/uncomplete-dynamic/`,
  completedHistory: `${API_BASE}/tasks/completed-history/`,
  weeklyStats: `${API_BASE}/tasks/weekly-stats/`,

  // User
  userStats: `${API_BASE}/user/stats/`,
  userProgress: `${API_BASE}/user/progress/`,

  // Goals
  goal: `${API_BASE}/goal/`
};

// API utility functions
export const apiRequest = async (url, options = {}) => {
  const defaultOptions = {
    credentials: 'include',  // Include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    debugLog('Making API request to:', url, 'with config:', config);
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    debugLog('API response:', data);
    return { data, response };
  } catch (error) {
    console.error('API request failed:', error);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Connection error: Unable to connect to server. Please check if the backend is running.');
    }
    throw new Error(`Connection error: ${error.message}`);
  }
};

export default API_ENDPOINTS;
