import type { Suitability } from "../types";
import { suitabilityColor, suitabilityLabel } from "../lib/scoring";

interface Props {
  date: string;
  suitability: Suitability;
  selected: boolean;
  onClick: () => void;
  isToday?: boolean;
}

export default function SuitabilityCard({
  date,
  suitability,
  selected,
  onClick,
  isToday,
}: Props) {
  const color = suitabilityColor(suitability);
  const label = suitabilityLabel(suitability);
  const d = new Date(date + "T12:00:00");
  const dayName = isToday
    ? "Today"
    : d.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  // Background based on suitability
  const bgMap: Record<Suitability, string> = {
    optimal: "bg-green-50 dark:bg-green-950/30",
    acceptable: "bg-amber-50 dark:bg-amber-950/30",
    unsuitable: "bg-red-50 dark:bg-red-950/30",
  };

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl transition-all overflow-hidden ${
        isToday ? "w-full p-5" : "flex-1 p-3"
      } ${bgMap[suitability]} ${
        selected
          ? "ring-2 shadow-md"
          : "shadow-sm hover:shadow-md"
      }`}
      style={{
        borderLeft: `4px solid ${color}`,
        ...(selected ? { ringColor: color } : {}),
      }}
    >
      <div className={`flex ${isToday ? "items-center gap-4" : "flex-col items-center gap-1"}`}>
        <div className={isToday ? "flex-1" : "text-center"}>
          <p
            className={`font-bold ${isToday ? "text-lg" : "text-xs"}`}
            style={{ color }}
          >
            {label}
          </p>
          <p className={`text-stone-500 ${isToday ? "text-sm" : "text-[10px]"}`}>
            {dayName}
          </p>
          <p className={`text-stone-400 ${isToday ? "text-xs" : "text-[9px]"}`}>
            {dateStr}
          </p>
        </div>
        {isToday && (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}18` }}
          >
            <span className="text-2xl">
              {suitability === "optimal"
                ? "✓"
                : suitability === "acceptable"
                  ? "~"
                  : "✗"}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
