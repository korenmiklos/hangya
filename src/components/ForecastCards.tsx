import type { DailyScore } from "../types";
import SuitabilityCard from "./SuitabilityCard";

interface Props {
  scores: DailyScore[];
  selectedDay: number;
  onSelectDay: (idx: number) => void;
}

export default function ForecastCards({
  scores,
  selectedDay,
  onSelectDay,
}: Props) {
  if (scores.length === 0) return null;

  const today = scores[0];
  const forecast = scores.slice(1, 5);

  return (
    <div className="mt-4 space-y-3">
      {/* Today's card — large, selected by default */}
      <SuitabilityCard
        date={today.date}
        suitability={today.suitability}
        selected={selectedDay === 0}
        onClick={() => onSelectDay(0)}
        isToday
      />

      {/* Forecast cards — smaller, in a row */}
      {forecast.length > 0 && (
        <div className="flex gap-2">
          {forecast.map((s, i) => (
            <SuitabilityCard
              key={s.date}
              date={s.date}
              suitability={s.suitability}
              selected={selectedDay === i + 1}
              onClick={() => onSelectDay(i + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
