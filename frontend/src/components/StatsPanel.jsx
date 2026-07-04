import { useEffect, useRef, useState } from "react";

const STAT_ROWS = [
  { key: "intelligence", label: "Intelligence", color: "#8B6F47" },
  { key: "discipline",   label: "Discipline",   color: "#6B4F2C" },
  { key: "energy",       label: "Energy",       color: "#D4A04C" },
  { key: "social",       label: "Social",       color: "#D49AAE" },
  { key: "wellness",     label: "Wellness",     color: "#8FA67B" },
  { key: "stress",       label: "Stress",       color: "#B85C42" },
];

const StatsPanel = ({ stats = {} }) => {
  const getMaxValue = (statKey) => (statKey === "stress" ? 100 : 1000);

  // When a stat changes, float its delta next to the number for a moment so
  // the gain (or loss) is visibly earned rather than silently swapped.
  const prevStats = useRef(stats);
  const [deltas, setDeltas] = useState({});
  const clearTimer = useRef(null);

  useEffect(() => {
    const diffs = {};
    for (const { key } of STAT_ROWS) {
      const delta = (stats?.[key] || 0) - (prevStats.current?.[key] || 0);
      if (delta !== 0) diffs[key] = delta;
    }
    prevStats.current = stats;
    if (Object.keys(diffs).length > 0) {
      // Merge rather than replace, so a change to one stat doesn't cut off
      // another stat's delta that's still mid-animation.
      setDeltas((prev) => ({ ...prev, ...diffs }));
      clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setDeltas({}), 1500);
    }
  }, [stats]);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  // For stress, a decrease is the good outcome
  const isGoodChange = (key, delta) => (key === "stress" ? delta < 0 : delta > 0);

  return (
    <div className="px-5 py-4">
      <div className="space-y-3">
        {STAT_ROWS.map(({ key, label, color }) => {
          const value = stats?.[key] || 0;
          const maxValue = getMaxValue(key);
          const percentage = Math.min((value / maxValue) * 100, 100);

          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm text-ink font-semibold tracking-wide">
                  {label}
                </span>
                <span className="relative text-sm text-ink-soft tabular-nums">
                  {deltas[key] !== undefined && (
                    <span
                      className={`float-gain absolute -top-1 right-0 text-xs font-bold ${
                        isGoodChange(key, deltas[key]) ? "text-sage" : "text-rust"
                      }`}
                      aria-hidden
                    >
                      {deltas[key] > 0 ? `+${deltas[key]}` : deltas[key]}
                    </span>
                  )}
                  <span className="font-semibold text-ink">{value}</span>
                  <span className="text-ink-mute"> / {maxValue}</span>
                </span>
              </div>
              <div className="stat-gauge-track">
                <div
                  className="stat-gauge-fill"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                    minWidth: value > 0 ? "3px" : "0px",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatsPanel;
