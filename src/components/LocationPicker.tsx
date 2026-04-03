import { useState } from "react";
import type { Location } from "../types";

interface Props {
  location: Location | null;
  onLocate: () => void;
  onLocationSet: (loc: Location) => void;
}

export default function LocationPicker({
  location,
  onLocate,
  onLocationSet,
}: Props) {
  const [showManual, setShowManual] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      onLocationSet({
        latitude,
        longitude,
        name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      });
      setShowManual(false);
    }
  };

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">📍</span>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {location?.name || "No location"}
            </p>
            {location && (
              <p className="text-xs text-stone-400">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onLocate}
            className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
          >
            GPS
          </button>
          <button
            onClick={() => setShowManual(!showManual)}
            className="px-3 py-1.5 bg-stone-200 dark:bg-stone-700 text-sm rounded-lg hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
          >
            Manual
          </button>
        </div>
      </div>

      {showManual && (
        <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-stone-300 dark:border-stone-600 rounded bg-transparent"
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-stone-300 dark:border-stone-600 rounded bg-transparent"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
          >
            Go
          </button>
        </form>
      )}
    </div>
  );
}
