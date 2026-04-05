import { useState, useEffect, useCallback } from "react";
import type { Location, DailyScore } from "./types";
import { fetchWeather, fetchGDDData } from "./lib/weather";
import { computeDailyScores } from "./lib/scoring";
import { getCurrentPosition, reverseGeocode } from "./lib/location";
import Header from "./components/Header";
import LocationPicker from "./components/LocationPicker";
import SeasonIndicator from "./components/SeasonIndicator";
import ForecastCards from "./components/ForecastCards";
import MetricsGrid from "./components/MetricsGrid";
import SearchTerrain from "./components/SearchTerrain";
import SpeciesList from "./components/SpeciesList";

function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const loadWeather = useCallback(async (loc: Location) => {
    setLoading(true);
    setError(null);
    try {
      const [weather, gddData] = await Promise.all([
        fetchWeather(loc.latitude, loc.longitude),
        fetchGDDData(loc.latitude, loc.longitude),
      ]);
      const scored = computeDailyScores(weather, gddData, loc.latitude);
      setScores(scored);
      setSelectedDay(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch weather");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocate = useCallback(async () => {
    try {
      setLoading(true);
      const pos = await getCurrentPosition();
      const name = await reverseGeocode(pos.latitude, pos.longitude);
      const loc = { ...pos, name };
      setLocation(loc);
      await loadWeather(loc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location error");
      setLoading(false);
    }
  }, [loadWeather]);

  const handleLocationSet = useCallback(
    (loc: Location) => {
      setLocation(loc);
      loadWeather(loc);
    },
    [loadWeather],
  );

  useEffect(() => {
    handleLocate();
  }, [handleLocate]);

  const currentScore = scores[selectedDay] ?? null;

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pb-8">
        <LocationPicker
          location={location}
          onLocate={handleLocate}
          onLocationSet={handleLocationSet}
        />

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading && !scores.length && (
          <div className="mt-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
            <p className="mt-2 text-stone-500">Loading weather data...</p>
          </div>
        )}

        {currentScore && (
          <>
            <SeasonIndicator
              season={currentScore.season}
              accumulatedGDD5={currentScore.accumulatedGDD5}
              daylightMinutes={currentScore.daylightMinutes}
              flightWindow={currentScore.flightWindow}
              searchWindow={currentScore.searchWindow}
            />

            <ForecastCards
              scores={scores}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />

            <MetricsGrid
              factors={currentScore.factors}
              flightWindow={currentScore.flightWindow}
            />

            <SearchTerrain season={currentScore.season} />

            <SpeciesList season={currentScore.season} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
