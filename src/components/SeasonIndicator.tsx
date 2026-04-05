import type { Season } from "../types";
import { SEASON_CONFIGS } from "../lib/seasons";

interface Props {
  season: Season;
  accumulatedGDD5: number;
  daylightMinutes: number;
  flightWindow: string;
  searchWindow: string;
}

export default function SeasonIndicator({
  season,
  accumulatedGDD5,
  daylightMinutes,
  flightWindow,
  searchWindow,
}: Props) {
  const config = SEASON_CONFIGS[season];
  const hours = Math.floor(daylightMinutes / 60);
  const minutes = daylightMinutes % 60;

  // GDD progress: scale from 0 to 2500 (beyond late summer threshold)
  const gddMax = 2500;
  const gddPct = Math.min(100, (accumulatedGDD5 / gddMax) * 100);

  // SVG circular progress
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (gddPct / 100) * circumference;
  const center = size / 2;

  // Season color based on current season
  const seasonColors: Record<Season, string> = {
    early_spring: "#16a34a",
    late_spring: "#d97706",
    peak_summer: "#dc2626",
    late_summer: "#9333ea",
  };
  const color = seasonColors[season];

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-5">
        {/* GDD Circular Progress */}
        <div className="relative shrink-0">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-stone-200 dark:text-stone-700"
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl">{config.emoji}</span>
            <span className="text-xs font-bold" style={{ color }}>
              {accumulatedGDD5}
            </span>
            <span className="text-[9px] text-stone-400">GDD</span>
          </div>
        </div>

        {/* Season info */}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold" style={{ color }}>
            {config.emoji} {config.label}
          </p>
          <div className="mt-2 space-y-1 text-sm text-stone-600 dark:text-stone-400">
            <p>
              <span className="text-stone-400 dark:text-stone-500">Daylight:</span>{" "}
              <span className="font-medium">{hours}h {String(minutes).padStart(2, "0")}m</span>
            </p>
            <p>
              <span className="text-stone-400 dark:text-stone-500">Flight window:</span>{" "}
              <span className="font-medium">{flightWindow}</span>
            </p>
            <p>
              <span className="text-stone-400 dark:text-stone-500">Search window:</span>{" "}
              <span className="font-medium">{searchWindow}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
