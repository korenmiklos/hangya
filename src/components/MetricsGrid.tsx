import type { FactorResult } from "../types";
import { ratingColor } from "../lib/scoring";

interface Props {
  factors: FactorResult[];
  flightWindow: string;
}

export default function MetricsGrid({ factors, flightWindow }: Props) {
  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Weather Conditions</h2>
        <span className="text-xs text-stone-400">
          Flight window {flightWindow}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {factors.map((f) => {
          const color = ratingColor(f.rating);
          return (
            <div key={f.name} className="flex items-center gap-2">
              {/* Colored dot */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-tight">
                  {f.displayName}
                </p>
                <p className="text-sm font-medium leading-tight">
                  {f.value}
                  <span className="text-xs text-stone-400 ml-0.5">
                    {f.unit}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
