import { useState } from "react";
import type { DailyScore } from "../types";
import { scoreColor } from "../lib/scoring";

interface Props {
  score: DailyScore;
}

export default function WeatherDetails({ score }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
      >
        <span>Factor Breakdown</span>
        <span
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-stone-400 mb-2">
            Averaged over flight window ({score.flightWindow})
          </p>
          {score.factors.map((f) => {
            const pct = Math.round(f.score * 100);
            const color = scoreColor(pct);
            return (
              <div key={f.name} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-stone-500 shrink-0">{f.name}</span>
                <div className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-16 text-right text-xs text-stone-500 shrink-0">
                  {f.name === "Daily Low" && f.value === -99
                    ? "n/a"
                    : f.name === "Prev. Days"
                      ? f.score >= 0.7
                        ? "Yes"
                        : "No"
                      : `${f.value}${f.unit}`}
                </span>
                <span className="w-12 text-right text-xs text-stone-400 shrink-0">
                  ({f.ideal})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
