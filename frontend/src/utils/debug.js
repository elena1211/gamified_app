// Debug utility for conditional logging
const isDevelopment = import.meta.env.MODE === 'development';

export const debugLog = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export const debugWarn = (...args) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

export const debugError = (...args) => {
  if (isDevelopment) {
    console.error(...args);
  }
};
