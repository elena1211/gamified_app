// API Configuration
const API_BASE_URL = 'http://127.0.0.1:8000/api';

export const API_ENDPOINTS = {
  // Authentication
  login: `${API_BASE_URL}/login/`,
  register: `${API_BASE_URL}/register/`,
  
  // Tasks
  tasks: `${API_BASE_URL}/tasks/`,
  taskComplete: `${API_BASE_URL}/tasks/complete/`,
  
  // User
  userStats: `${API_BASE_URL}/user/stats/`,
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
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return { data, response };
  } catch (error) {
    throw new Error(`Connection error: ${error.message}`);
  }
};

export default API_ENDPOINTS;
