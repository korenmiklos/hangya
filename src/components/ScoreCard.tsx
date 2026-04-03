import type { DailyScore } from "../types";
import ScoreGauge from "./ScoreGauge";
import { scoreColor } from "../lib/scoring";

interface Props {
  score: DailyScore;
}

export default function ScoreCard({ score }: Props) {
  const color = scoreColor(score.score);

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-6 shadow-sm text-center">
      <p
        className="text-xs font-medium uppercase tracking-wider mb-1"
        style={{ color }}
      >
        {score.regime === "spring" ? "🌸 Spring" : "☀️ Summer"} &middot;
        Flight window {score.flightWindow}
      </p>

      <ScoreGauge score={score.score} />

      <p className="mt-3 text-lg font-semibold" style={{ color }}>
        {score.label}
      </p>
      <p className="text-xs text-stone-400 mt-1">Ant Flight Probability</p>
    </div>
  );
}
