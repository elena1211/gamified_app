import { useState, useEffect } from "react";
import { cleanTaskTitle } from "../utils/taskUtils";

export default function TaskList({ tasks: initialTasks, onTaskComplete }) {
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    const validTasks = initialTasks.filter((task) => {
      const cleanTitle = cleanTaskTitle(task.title);
      if (
        /^\d+$/.test(cleanTitle) ||
        cleanTitle === "Task Loading..." ||
        cleanTitle === "Task Unavailable" ||
        !task.title ||
        task.title.trim() === ""
      ) {
        console.warn("Filtering out problematic task:", task);
        return false;
      }
      return true;
    });
    setTasks(validTasks);
  }, [initialTasks]);

  const toggleTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (onTaskComplete) onTaskComplete(task);
  };

  return (
    <div className="px-5 py-4">
      <ul className="divide-y divide-[var(--frame)]/30">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => toggleTask(task.id)}
              className={`w-full text-left flex items-start gap-3 py-3 px-1 transition-colors ${
                task.completed
                  ? "opacity-60"
                  : "hover:bg-[var(--paper)]/50"
              }`}
            >
              <span
                className={`task-diamond mt-1 ${task.completed ? "checked" : ""}`}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div
                  className={`text-base font-semibold leading-snug ${
                    task.completed ? "line-through text-ink-mute" : "text-ink"
                  }`}
                >
                  {cleanTaskTitle(task.title) || `Task ${task.id}`}
                </div>
                {task.tip && (
                  <p className="text-xs text-ink-soft mt-1 italic">
                    — {task.tip}
                  </p>
                )}
                {task.reward && (
                  <p className="text-xs text-gold font-semibold mt-1 tracking-wide">
                    {task.reward}
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-mute italic">
            No tasks today — try drawing a new set below.
          </li>
        )}
      </ul>
    </div>
  );
}
