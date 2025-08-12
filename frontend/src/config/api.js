// API Configuration
const API_BASE_URL = 'http://127.0.0.1:8000/api';

export const API_ENDPOINTS = {
  // Authentication
  login: `${API_BASE_URL}/login/`,
  register: `${API_BASE_URL}/register/`,

  // Tasks
  tasks: `${API_BASE_URL}/tasks/`,
  taskComplete: `${API_BASE_URL}/tasks/complete/`,
  dynamicTaskComplete: `${API_BASE_URL}/tasks/complete-dynamic/`,
  dynamicTaskUncomplete: `${API_BASE_URL}/tasks/uncomplete-dynamic/`,
  completedHistory: `${API_BASE_URL}/tasks/completed-history/`,
  weeklyStats: `${API_BASE_URL}/tasks/weekly-stats/`,

  // User
  userStats: `${API_BASE_URL}/user/stats/`,
  userProgress: `${API_BASE_URL}/user/progress/`,
  changePassword: `${API_BASE_URL}/user/change-password/`,
  deleteAccount: `${API_BASE_URL}/user/delete-account/`,

  // Goals
  goal: `${API_BASE_URL}/goal/`
};

// API utility functions
export const apiRequest = async (url, options = {}) => {
  const defaultOptions = {
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
    console.log('Making API request to:', url, 'with config:', config);
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
    console.log('API response:', data);
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
