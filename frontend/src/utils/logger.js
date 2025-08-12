// Simple logger utility for development
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  error: (...args) => {
    console.error(...args);
  },

  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.log('🐛', ...args);
    }
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
