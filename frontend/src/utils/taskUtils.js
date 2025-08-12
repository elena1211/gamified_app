/**
 * Utility functions for task management
 */

/**
 * Remove timestamp from task title
 * @param {string} title - Task title that may contain timestamp
 * @returns {string} - Clean title without timestamp
 */
export const cleanTaskTitle = (title) => {
  if (!title) return '';
  return title.replace(/ - \d{2}:\d{2}:\d{2}$/, '');
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
