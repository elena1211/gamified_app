import { Home, Settings, ClipboardList } from "lucide-react";

export default function BottomNav({
  onSettingsClick,
  onHomeClick,
  onTaskManagerClick,
  currentPage = "home",
}) {
  const itemClass = (active) =>
    `flex flex-col items-center gap-0.5 transition-colors ${
      active ? "text-rose" : "text-ink-soft hover:text-rose"
    }`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: "var(--paper)",
        borderTop: "2px solid var(--frame)",
        boxShadow: "0 -2px 0 rgba(107, 79, 44, 0.18)",
      }}
    >
      <div className="max-w-md mx-auto px-4 py-3 safe-area-pb">
        <div className="flex justify-center items-center gap-12">
          <button onClick={onHomeClick} className={itemClass(currentPage === "home")}>
            <Home size={22} />
            <span className="text-[11px] tracking-wider uppercase font-semibold">
              Home
            </span>
          </button>

          <button
            onClick={onTaskManagerClick}
            className={itemClass(currentPage === "tasks")}
          >
            <ClipboardList size={22} />
            <span className="text-[11px] tracking-wider uppercase font-semibold">
              Tasks
            </span>
          </button>

          <button
            onClick={onSettingsClick}
            className={itemClass(currentPage === "settings")}
          >
            <Settings size={22} />
            <span className="text-[11px] tracking-wider uppercase font-semibold">
              Settings
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
