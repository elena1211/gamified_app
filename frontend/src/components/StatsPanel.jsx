export default function StatsPanel({ stats }) {
  console.log('StatsPanel received stats:', stats); // Debug log
  
  const statNames = [
    { key: "intelligence", label: "Intelligence", emoji: "🧠" },
    { key: "discipline", label: "Discipline", emoji: "💪" },
    { key: "energy", label: "Energy", emoji: "⚡" },
    { key: "charisma", label: "Charisma", emoji: "✨" },
    { key: "stress", label: "Stress", emoji: "😰" }
  ];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="font-bold text-lg mb-4 text-gray-800">📊 Your Stats</h3>
      <div className="space-y-4">
        {statNames.map(({ key, label, emoji }) => {
          const value = stats?.[key] || 0;
          console.log(`${label}: ${value}%`); // Debug each stat
          return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 font-medium flex items-center gap-2">
                  <span>{emoji}</span>
                  {label}
                </span>
                <span className="text-sm text-gray-700 font-bold">{value}%</span>
              </div>
              <div 
                style={{
                  backgroundColor: '#f3f4f6', // Light gray background
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{ 
                    width: `${value}%`,
                    height: '100%',
                    backgroundColor: '#ec4899', // Pink color
                    borderRadius: '4px',
                    transition: 'width 1s ease-out',
                    minWidth: value > 0 ? '2px' : '0px'
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

