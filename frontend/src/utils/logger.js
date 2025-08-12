// Unified logging utility for development
const isDevelopment = import.meta.env.MODE === 'development';

export const logger = {
  log: () => {
    // Temporarily disable to reduce flicker
    // if (isDevelopment) {
    //   console.log(...args);
    // }
  },

  error: (...args) => {
    console.error(...args);
  },

  warn: () => {
    // Temporarily disable to reduce flicker
    // if (isDevelopment) {
    //   console.warn(...args);
    // }
  },

  debug: () => {
    // Temporarily disable to reduce flicker
    // if (isDevelopment) {
    //   console.log('🐛', ...args);
    // }
  },

  api: (...args) => {
    if (isDevelopment) {
      console.log('📡', ...args);
    }
  },

  task: (...args) => {
    if (isDevelopment) {
      console.log('🎯', ...args);
    }
  },

  stats: (...args) => {
    if (isDevelopment) {
      console.log('📊', ...args);
    }
  }
};

// Export simplified debug functions for backward compatibility
export const debugLog = logger.log;
export const debugWarn = logger.warn;
export const debugError = logger.error;
