import { Home, Settings, ClipboardList, Cpu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext.jsx";

export default function BottomNav({
  onSettingsClick,
  onHomeClick,
  onTaskManagerClick,
  onSystemClick,
  currentPage = "home",
}) {
  const navigate = useNavigate();
  const { unreadSystemMessages } = useAppContext();

  const itemClass = (active) =>
    `flex flex-col items-center gap-0.5 transition-colors relative ${
      active ? "text-rose" : "text-ink-soft hover:text-rose"
    }`;

  const handleSystemClick = () => {
    if (onSystemClick) onSystemClick();
    else navigate("/system");
  };

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
        <div className="flex justify-center items-center gap-8">
          <button onClick={onHomeClick} className={itemClass(currentPage === "home")}>
            <Home size={22} />
            <span className="text-[11px] tracking-wider uppercase font-semibold">Home</span>
          </button>

          <button onClick={handleSystemClick} className={itemClass(currentPage === "system")}>
            <span className="relative inline-block">
              <Cpu size={22} />
              {unreadSystemMessages > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: "var(--accent-rust)", color: "var(--paper)" }}
                >
                  {unreadSystemMessages > 9 ? "9+" : unreadSystemMessages}
                </span>
              )}
            </span>
            <span className="text-[11px] tracking-wider uppercase font-semibold">System</span>
          </button>

          <button onClick={onTaskManagerClick} className={itemClass(currentPage === "tasks")}>
            <ClipboardList size={22} />
            <span className="text-[11px] tracking-wider uppercase font-semibold">Tasks</span>
          </button>

          <button onClick={onSettingsClick} className={itemClass(currentPage === "settings")}>
            <Settings size={22} />
            <span className="text-[11px] tracking-wider uppercase font-semibold">Settings</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
