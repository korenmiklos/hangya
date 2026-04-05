import { useState } from "react";
import type { Season } from "../types";
import type { SpeciesInfo } from "../types";
import { SEASON_CONFIGS } from "../lib/seasons";
import { getSpeciesForSeason } from "../lib/species";

interface Props {
  season: Season;
}

function SpeciesPhoto({ species }: { species: SpeciesInfo }) {
  const [error, setError] = useState(false);

  if (error || !species.photoUrl) {
    return (
      <a
        href={species.antWikiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full h-32 bg-stone-100 dark:bg-stone-700 rounded-lg flex items-center justify-center text-stone-400 hover:text-amber-600 transition-colors"
      >
        <span className="text-center text-xs">
          <span className="block text-2xl mb-1">🐜</span>
          View on AntWiki
        </span>
      </a>
    );
  }

  return (
    <a
      href={species.antWikiUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <img
        src={species.photoUrl}
        alt={`${species.scientificName} queen`}
        className="w-full h-32 object-cover rounded-lg bg-stone-100 dark:bg-stone-700"
        onError={() => setError(true)}
      />
    </a>
  );
}

export default function SpeciesList({ season }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const config = SEASON_CONFIGS[season];
  const species = getSpeciesForSeason(config.species);

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold mb-3">Active Species</h2>

      <div className="space-y-1">
        {species.map((sp, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={sp.scientificName}>
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center gap-2"
              >
                <span>🐜</span>
                <span className="text-sm font-medium italic flex-1">
                  {sp.scientificName}
                </span>
                <span
                  className={`text-xs text-stone-400 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {isExpanded && (
                <div className="ml-8 mr-3 mb-2 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg">
                  {sp.commonName && (
                    <p className="text-sm font-medium mb-2">{sp.commonName}</p>
                  )}

                  <div className="mb-3">
                    <SpeciesPhoto species={sp} />
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                    {sp.queenSize && (
                      <div className="flex gap-2">
                        <span className="text-stone-400 dark:text-stone-500 shrink-0 w-16">Queen size</span>
                        <span>{sp.queenSize}</span>
                      </div>
                    )}
                    {sp.lifestyle && (
                      <div className="flex gap-2">
                        <span className="text-stone-400 dark:text-stone-500 shrink-0 w-16">Lifestyle</span>
                        <span>{sp.lifestyle}</span>
                      </div>
                    )}
                    {sp.society && (
                      <div className="flex gap-2">
                        <span className="text-stone-400 dark:text-stone-500 shrink-0 w-16">Society</span>
                        <span>{sp.society}</span>
                      </div>
                    )}
                    {sp.diet && (
                      <div className="flex gap-2">
                        <span className="text-stone-400 dark:text-stone-500 shrink-0 w-16">Diet</span>
                        <span>{sp.diet}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={sp.antWikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    View full profile on AntWiki →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
