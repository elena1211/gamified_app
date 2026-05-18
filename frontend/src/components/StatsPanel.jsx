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
                <span className="text-sm text-ink-soft tabular-nums">
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
