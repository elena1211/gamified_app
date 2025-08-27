/**
 * Utility functions for task management
 */

/**
 * Remove timestamp from task title
 * @param {string} title - Task title that may contain timestamp
 * @returns {string} - Clean title without timestamp
 */
export const cleanTaskTitle = (title) => {
  // Handle various edge cases
  if (!title || typeof title !== 'string' || title.trim() === '') {
    console.warn('Invalid or empty task title:', title);
    return 'Task Unavailable';
  }

  // If title is just a number (problematic case), return a meaningful message
  if (/^\d+$/.test(title.trim())) {
    console.warn('Numeric title detected, this should not happen:', title);
    return 'Task Loading...';
  }

  // Remove timestamp and clean
  const cleaned = title.replace(/ - \d{2}:\d{2}:\d{2}$/, '').trim();

  // Final check
  if (!cleaned || cleaned.length === 0) {
    return 'Task Unavailable';
  }

  return cleaned;
};

/**
 * Check if task title has timestamp
 * @param {string} title - Task title to check
 * @returns {boolean} - True if title contains timestamp
 */
export const hasTimestamp = (title) => {
  if (!title) return false;
  return / - \d{2}:\d{2}:\d{2}$/.test(title);
};
