import { useState, useEffect, useRef } from "react";
import { cleanTaskTitle } from "../utils/taskUtils";

export default function TaskList({ tasks: initialTasks, onTaskComplete }) {
  const [tasks, setTasks] = useState(initialTasks);
  // The task the user just completed, kept briefly so the diamond pops and
  // the reward floats up once — then cleared.
  const [justCompleted, setJustCompleted] = useState(null);
  const feedbackTimer = useRef(null);
  // Ids currently mid-toggle — blocks a rapid double-tap from firing
  // onTaskComplete twice before the optimistic update re-renders this list.
  const pendingIds = useRef(new Set());

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

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

  const toggleTask = async (id) => {
    if (pendingIds.current.has(id)) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || !onTaskComplete) return;

    pendingIds.current.add(id);
    try {
      await onTaskComplete(task);
    } finally {
      pendingIds.current.delete(id);
    }

    // Only flash the pop/reward feedback when checking a task off, not
    // when un-checking it to fix a mis-tap.
    if (!task.completed) {
      setJustCompleted(task);
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setJustCompleted(null), 1500);
    }
  };

  return (
    <div className="px-5 py-4">
      <ul className="divide-y divide-[var(--frame)]/30">
        {tasks.map((task) => (
          <li key={task.id} className="stagger-item">
            <button
              type="button"
              onClick={() => toggleTask(task.id)}
              className={`relative w-full text-left flex items-start gap-3 py-3 px-1 transition-colors ${
                task.completed
                  ? "opacity-60"
                  : "hover:bg-[var(--paper)]/50"
              }`}
            >
              <span
                className={`task-diamond mt-1 ${task.completed ? "checked" : ""} ${
                  justCompleted?.id === task.id ? "just-checked" : ""
                }`}
                aria-hidden
              />
              {/* Floats a duplicate of the permanent reward text below,
                  timed to fade before that text settles into view. */}
              {justCompleted?.id === task.id && justCompleted.reward && (
                <span
                  className="float-gain absolute right-2 top-1 text-sm font-bold text-gold"
                  aria-hidden
                >
                  {justCompleted.reward}
                </span>
              )}
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
