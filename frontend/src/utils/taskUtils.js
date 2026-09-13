/**
 * Utility functions for task management
 */
import { debugWarn } from './logger';

/**
 * Remove timestamp from task title
 * @param {string} title - Task title that may contain timestamp
 * @returns {string} - Clean title without timestamp
 */
export const cleanTaskTitle = (title) => {
  // Handle various edge cases
  if (!title || typeof title !== 'string' || title.trim() === '') {
    debugWarn('Invalid or empty task title:', title);
    return 'Task Unavailable';
  }

  // If title is just a number (problematic case), return a meaningful message
  if (/^\d+$/.test(title.trim())) {
    debugWarn('Numeric title detected, this should not happen:', title);
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

