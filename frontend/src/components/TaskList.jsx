import { useState, useEffect } from "react";

export default function TaskList({ tasks: initialTasks, onTaskComplete, onTaskUncomplete }) {
  const [tasks, setTasks] = useState(initialTasks);

  // Synchronise internal state when external tasks update
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id);
    const updated = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updated);
    
    // Trigger appropriate callback based on task state change
    if (!task.completed && onTaskComplete) {
      onTaskComplete(task);
    } else if (task.completed && onTaskUncomplete) {
      onTaskUncomplete(task);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-lg mb-4 text-gray-800">📋 Today's Tasks</h3>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-3 rounded-xl border-2 transition-all ${
              task.completed 
                ? 'bg-green-50 border-green-200' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                className="mt-1 w-5 h-5 accent-pink-500 rounded"
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm font-medium block ${
                    task.completed ? "line-through text-gray-400" : "text-gray-800"
                  }`}
                >
                  {task.title}
                </span>
                {task.tip && (
                  <p className="text-xs text-gray-500 mt-1">💡 {task.tip}</p>
                )}
                {task.reward && (
                  <p className="text-xs text-green-600 mt-1 font-medium">🎁 {task.reward}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
