const StatsPanel = ({ stats = {} }) => {
  const statNames = [
    { key: "intelligence", label: "Intelligence", emoji: "🧠", color: "#8b5cf6" },
    { key: "discipline", label: "Discipline", emoji: "💪", color: "#06b6d4" },
    { key: "energy", label: "Energy", emoji: "⚡", color: "#eab308" },
    { key: "social", label: "Social", emoji: "👥", color: "#ec4899" },
    { key: "wellness", label: "Wellness", emoji: "❤️", color: "#10b981" },
    { key: "stress", label: "Stress", emoji: "😰", color: "#ef4444" }
  ];

  const MAX_STAT_VALUE = 1000;
  // Set stress max value to 100, others to 1000
  const getMaxValue = (statKey) => {
    return statKey === 'stress' ? 100 : 1000;
  };

  return (
    <div>
      <h3 className="font-bold text-lg mb-6 text-gray-800">📊 Statistics</h3>
      <div className="space-y-5">
        {statNames.map(({ key, label, emoji, color }) => {
          const value = stats?.[key] || 0;
          const maxValue = getMaxValue(key);
          const percentage = Math.min((value / maxValue) * 100, 100);

          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                  <span className="text-base">{emoji}</span>
                  <span>{label}</span>
                </span>
                <span className="text-sm text-gray-600 font-semibold">{value}/{maxValue}</span>
              </div>
              <div className="relative">
                <div
                  className="w-full bg-gray-200 rounded-full overflow-hidden"
                  style={{
                    height: '10px',
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color,
                      minWidth: value > 0 ? '4px' : '0px',
                      boxShadow: value > 0 ? `0 0 8px ${color}40` : 'none'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default StatsPanel;
