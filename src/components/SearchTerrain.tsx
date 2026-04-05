import type { Season } from "../types";
import { SEASON_CONFIGS } from "../lib/seasons";

interface Props {
  season: Season;
}

export default function SearchTerrain({ season }: Props) {
  const config = SEASON_CONFIGS[season];
  const { landing, founding } = config.searchTerrain;

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold mb-3">Where to Search</h2>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
            Landing Sites
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            {landing}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
            Founding Sites
          </p>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            {founding}
          </p>
        </div>
      </div>
    </div>
  );
}
