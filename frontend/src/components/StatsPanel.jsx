export default function StatsPanel({ stats }) {
  const statNames = [
    { key: "knowledge", label: "Knowledge", emoji: "📚", color: "#8b5cf6" },
    { key: "discipline", label: "Discipline", emoji: "💪", color: "#06b6d4" },
    { key: "energy", label: "Energy", emoji: "⚡", color: "#eab308" },
    { key: "charisma", label: "Charisma", emoji: "✨", color: "#ec4899" },
    { key: "stress", label: "Stress", emoji: "😰", color: "#ef4444" }
  ];

  return (
    <div>
      <h3 className="font-bold text-lg mb-6 text-gray-800">📊 Your Stats</h3>
      <div className="space-y-5">
        {statNames.map(({ key, label, emoji, color }) => {
          const value = stats?.[key] || 0;
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                  <span className="text-base">{emoji}</span>
                  <span>{label}</span>
                </span>
                <span className="text-sm text-gray-600 font-semibold">{value}%</span>
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
                      width: `${value}%`,
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