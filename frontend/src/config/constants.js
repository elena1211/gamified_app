// Common constants used across the application

export const COLORS = {
  gradient: {
    primary: 'from-pink-500 to-purple-600',
    primaryHover: 'from-pink-600 to-purple-700',
    background: 'from-pink-100 via-purple-100 to-blue-100',
    goal: 'from-blue-500 to-cyan-500',
  },
  
  button: {
    primary: 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700',
    secondary: 'bg-gray-100 hover:bg-gray-200',
    success: 'bg-green-500 hover:bg-green-600',
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-orange-500 hover:bg-orange-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
  },
  
  text: {
    primary: 'text-gray-800',
    secondary: 'text-gray-600',
    muted: 'text-gray-500',
    error: 'text-red-700',
  }
};

export const EMOJIS = {
  logo: '🎮',
  login: '🔐',
  goal: '🎯',
  task: '📋',
  streak: '🔥',
  stats: '📊',
  rocket: '🚀',
  refresh: '🔄',
  lightning: '⚡',
};

export const ANIMATION_CLASSES = {
  button: 'transition-all duration-300 hover:scale-105',
  buttonDisabled: 'disabled:opacity-50 disabled:hover:scale-100',
  card: 'shadow-lg transition-all duration-300 hover:shadow-xl',
  loading: 'animate-pulse',
  spinner: 'animate-spin',
};

export const LAYOUT_CLASSES = {
  container: 'min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center p-4',
  card: 'bg-white rounded-2xl shadow-lg',
  cardLarge: 'bg-white rounded-3xl shadow-xl',
  input: 'w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent',
};

export default {
  COLORS,
  EMOJIS,
  ANIMATION_CLASSES,
  LAYOUT_CLASSES,
};
