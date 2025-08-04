export default function TaskCard({ task }) {
  const handleComplete = () => {
    console.log("✅ Task Completed!");
  };

  const handleFail = () => {
    console.log("❌ Task Failed!");
  };

  return (
    <div className="p-4 border rounded-2xl shadow-md bg-yellow-50 max-w-md mx-auto space-y-2 mt-4">
      <h3 className="text-lg font-semibold">{task.title}</h3>
      <p className="text-sm text-gray-600">💡 Tip: {task.tip}</p>
      <p className="text-sm">🎁 Reward: {task.reward}</p>
      <div className="flex gap-2 mt-2">
        <button onClick={handleComplete} className="px-3 py-1 rounded-full bg-green-500 text-white">Complete</button>
        <button onClick={handleFail} className="px-3 py-1 rounded-full bg-red-500 text-white">Fail</button>
      </div>
    </div>
  );
}
