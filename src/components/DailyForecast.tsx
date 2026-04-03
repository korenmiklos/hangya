import type { DailyScore } from "../types";
import { scoreColor } from "../lib/scoring";

interface Props {
  scores: DailyScore[];
  selectedDay: number;
  onSelectDay: (idx: number) => void;
}

function formatDay(dateStr: string, idx: number): { day: string; date: string } {
  if (idx === 0) return { day: "Today", date: "" };
  const d = new Date(dateStr + "T12:00:00");
  return {
    day: d.toLocaleDateString(undefined, { weekday: "short" }),
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

export default function DailyForecast({
  scores,
  selectedDay,
  onSelectDay,
}: Props) {
  return (
    <div className="mt-4 grid grid-cols-5 gap-2">
      {scores.map((s, i) => {
        const { day, date } = formatDay(s.date, i);
        const isSelected = i === selectedDay;
        const color = scoreColor(s.score);

        return (
          <button
            key={s.date}
            onClick={() => onSelectDay(i)}
            className={`flex flex-col items-center rounded-xl py-3 px-1 transition-all ${
              isSelected
                ? "bg-white dark:bg-stone-900 shadow-md ring-2 ring-amber-500"
                : "bg-white/50 dark:bg-stone-900/50 hover:bg-white dark:hover:bg-stone-900 shadow-sm"
            }`}
          >
            <span className="text-xs font-medium text-stone-500">{day}</span>
            {date && (
              <span className="text-[10px] text-stone-400">{date}</span>
            )}
            <span
              className="text-2xl font-bold mt-2"
              style={{ color }}
            >
              {s.score}
            </span>
            <span className="text-[10px] mt-1" style={{ color }}>
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
