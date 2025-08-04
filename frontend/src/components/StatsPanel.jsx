export default function StatsPanel() {
  const stats = {
    knowledge: 60,
    discipline: 40,
    energy: 75,
    charisma: 50,
    stress: 20,
  };

  return (
    <div className="p-4 rounded-2xl shadow-md bg-white max-w-md mx-auto space-y-4">
      <h2 className="text-xl font-bold">🎮 Your Character Stats</h2>
      {Object.entries(stats).map(([key, value]) => (
        <div key={key}>
          <div className="flex justify-between">
            <span className="capitalize">{key}</span>
            <span>{value}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${value}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}
