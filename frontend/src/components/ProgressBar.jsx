import { useEffect, useState } from 'react';

export default function ProgressBar({ 
  value = 0, 
  size = 'medium', 
  showPercentage = true,
  label = '',
  animated = true,
  color = 'pink'
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  // Normalize value to percentage
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));
  
  // Animate progress bar on mount/value change
  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setAnimatedValue(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedValue(percentage);
    }
  }, [percentage, animated]);
  
  // Size configurations
  const sizeClasses = {
    small: 'h-2',
    medium: 'h-3',
    large: 'h-4'
  };
  
  // Color configurations
  const colorClasses = {
    pink: 'bg-gradient-to-r from-pink-400 to-pink-600',
    purple: 'bg-gradient-to-r from-purple-400 to-purple-600',
    blue: 'bg-gradient-to-r from-blue-400 to-blue-600',
    green: 'bg-gradient-to-r from-green-400 to-green-600',
    orange: 'bg-gradient-to-r from-orange-400 to-orange-600'
  };
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm text-gray-600">{percentage}%</span>
          )}
        </div>
      )}
      
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div 
          className={`${sizeClasses[size]} ${colorClasses[color]} transition-all duration-1000 ease-out rounded-full relative overflow-hidden`}
          style={{ width: `${animatedValue}%` }}
        >
          {/* Shine effect for enhanced visual appeal */}
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}
        </div>
      </div>
      
      {!label && showPercentage && (
        <div className="text-right mt-1">
          <span className="text-xs text-gray-600">{percentage}%</span>
        </div>
      )}
    </div>
  );
}
