import { useState, useRef, useEffect } from "react";
import type { Location } from "../types";
import { searchTown, type TownSuggestion } from "../lib/location";

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
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TownSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    searchTown(value, (results) => {
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    });
  };

  const handleSelectTown = (town: TownSuggestion) => {
    onLocationSet({
      latitude: town.latitude,
      longitude: town.longitude,
      name: town.name,
    });
    setQuery(town.name);
    setShowSuggestions(false);
  };

  const handleCoordsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      onLocationSet({
        latitude,
        longitude,
        name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      });
      setShowCoords(false);
    }
  };

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📍</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">
            {location?.name || "No location set"}
          </p>
          {location && (
            <p className="text-xs text-stone-400">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          )}
        </div>
        <button
          onClick={onLocate}
          className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors shrink-0"
          title="Use GPS"
        >
          GPS
        </button>
      </div>

      <div className="relative" ref={wrapperRef}>
        <input
          type="text"
          placeholder="Település keresése..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {showSuggestions && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSelectTown(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors border-b border-stone-100 dark:border-stone-700 last:border-b-0"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-stone-400 block truncate">
                  {s.displayName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowCoords(!showCoords)}
        className="mt-2 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
      >
        {showCoords ? "Hide coordinates" : "Enter coordinates manually"}
      </button>

      {showCoords && (
        <form onSubmit={handleCoordsSubmit} className="mt-2 flex gap-2">
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
