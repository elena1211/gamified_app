// API configuration and helper functions
import { debugLog } from "../utils/logger";

// Environment-based API configuration
const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const API_ENDPOINTS = {
  // Authentication
  login: `${API_BASE}/login/`,
  register: `${API_BASE}/register/`,
  guest: `${API_BASE}/guest/`,

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
  goal: `${API_BASE}/goal/`,

  // System / AI
  systemChat: `${API_BASE}/system/chat/`,
  systemMessages: `${API_BASE}/system/messages/`,
  systemDailyStatus: `${API_BASE}/system/daily-status/`,
  systemPunishmentCheck: `${API_BASE}/system/punishment-check/`,
};

// Render free-tier services sleep after 15 min and take 30-60s to wake.
// The first request after a sleep returns 502/503/504; retry with backoff
// so the UI doesn't surface a transient cold start as an error.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000, 6000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getAuthToken = () => localStorage.getItem('levelup_auth_token');

export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Token ${token}` } : {};
};

// API utility functions
export const apiRequest = async (url, options = {}) => {
  const defaultOptions = {
    mode: "cors", // Enable CORS mode for cross-origin requests
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
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

  debugLog("Making API request to:", url, "with config:", config);

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, config);

      if (response.ok) {
        const data = await response.json();
        debugLog("API response:", data);
        return { data, response };
      }

      // Retry only on transient 5xx (e.g. Render cold start).
      // 4xx is the client's fault — fail fast.
      if (!RETRYABLE_STATUS.has(response.status) || attempt === RETRY_DELAYS_MS.length) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          // DRF puts throttle/auth messages under "detail", our views use "error"
          errorMessage = errorData.error || errorData.detail || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      debugLog(
        `⏳ Got ${response.status}, retrying in ${RETRY_DELAYS_MS[attempt]}ms (server may be waking up)…`,
      );
      await sleep(RETRY_DELAYS_MS[attempt]);
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error.name === "TypeError" && error.message.includes("fetch");

      // On the final attempt, or on a non-retryable error, stop trying.
      if (!isNetworkError || attempt === RETRY_DELAYS_MS.length) {
        console.error("API request failed:", error);
        if (isNetworkError) {
          throw new Error(
            "Connection error: Unable to connect to server. Please check if the backend is running.",
          );
        }
        if (error.message.startsWith("HTTP error") || error.message.startsWith("Connection error")) {
          throw error;
        }
        throw new Error(`Connection error: ${error.message}`);
      }

      debugLog(
        `⏳ Network error, retrying in ${RETRY_DELAYS_MS[attempt]}ms…`,
      );
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  // Shouldn't reach here, but throw a defensive fallback rather than returning undefined.
  throw lastError || new Error("Connection error: max retries exceeded");
};

export default API_ENDPOINTS;
