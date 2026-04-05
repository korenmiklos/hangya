import type { HourlyWeather, WeatherResponse, GDDData } from "../types";

const FORECAST_API = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const forecastCache = new Map<string, CacheEntry<WeatherResponse>>();
const gddCache = new Map<string, CacheEntry<GDDData>>();

function cacheKey(lat: number, lng: number, prefix: string): string {
  return `${prefix}:${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherResponse> {
  const key = cacheKey(latitude, longitude, "forecast");
  const cached = forecastCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "surface_pressure",
      "wind_speed_10m",
      "cloud_cover",
    ].join(","),
    daily: "temperature_2m_max,temperature_2m_min",
    forecast_days: "5",
    past_days: "7",
    timezone: "auto",
  });

  const response = await fetch(`${FORECAST_API}?${params}`);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const json = await response.json();
  const hourly: HourlyWeather[] = json.hourly.time.map(
    (t: string, i: number) => ({
      time: t,
      temperature: json.hourly.temperature_2m[i],
      humidity: json.hourly.relative_humidity_2m[i],
      precipitation: json.hourly.precipitation[i],
      pressure: json.hourly.surface_pressure[i],
      windSpeed: json.hourly.wind_speed_10m[i],
      cloudCover: json.hourly.cloud_cover[i],
    }),
  );

  const result: WeatherResponse = {
    hourly,
    dailyMaxTemps: json.daily.temperature_2m_max,
    dailyMinTemps: json.daily.temperature_2m_min,
    dailyDates: json.daily.time,
  };

  forecastCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}

/**
 * Fetch daily max/min temps from Jan 1 of the current year to yesterday,
 * used for GDD_5 accumulation.
 */
export async function fetchGDDData(
  latitude: number,
  longitude: number,
): Promise<GDDData> {
  const key = cacheKey(latitude, longitude, "gdd");
  const cached = gddCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const now = new Date();
  const year = now.getFullYear();
  const startDate = `${year}-01-01`;

  // Archive API data ends ~5 days ago; use forecast API past_days to fill the gap
  const archiveEnd = new Date(now);
  archiveEnd.setDate(archiveEnd.getDate() - 6);
  const archiveEndStr = archiveEnd.toISOString().slice(0, 10);

  // Fetch archive data (Jan 1 to ~6 days ago)
  let archiveDailyMax: number[] = [];
  let archiveDailyMin: number[] = [];
  let archiveDates: string[] = [];

  if (archiveEnd > new Date(`${year}-01-01`)) {
    const archiveParams = new URLSearchParams({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      daily: "temperature_2m_max,temperature_2m_min",
      start_date: startDate,
      end_date: archiveEndStr,
      timezone: "auto",
    });

    try {
      const res = await fetch(`${ARCHIVE_API}?${archiveParams}`);
      if (res.ok) {
        const json = await res.json();
        archiveDailyMax = json.daily.temperature_2m_max || [];
        archiveDailyMin = json.daily.temperature_2m_min || [];
        archiveDates = json.daily.time || [];
      }
    } catch {
      // Fall back to forecast-only data
    }
  }

  // Fill in recent days from forecast API (past 7 days)
  const recentParams = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    daily: "temperature_2m_max,temperature_2m_min",
    past_days: "7",
    forecast_days: "1",
    timezone: "auto",
  });

  const recentRes = await fetch(`${FORECAST_API}?${recentParams}`);
  if (!recentRes.ok) {
    throw new Error(`Weather API error: ${recentRes.status}`);
  }
  const recentJson = await recentRes.json();
  const recentDates: string[] = recentJson.daily.time || [];
  const recentMax: number[] = recentJson.daily.temperature_2m_max || [];
  const recentMin: number[] = recentJson.daily.temperature_2m_min || [];

  // Merge: archive dates + recent dates (no duplicates)
  const archiveDateSet = new Set(archiveDates);
  const allDates: string[] = [...archiveDates];
  const allMax: number[] = [...archiveDailyMax];
  const allMin: number[] = [...archiveDailyMin];

  for (let i = 0; i < recentDates.length; i++) {
    if (!archiveDateSet.has(recentDates[i])) {
      allDates.push(recentDates[i]);
      allMax.push(recentMax[i]);
      allMin.push(recentMin[i]);
    }
  }

  // Calculate accumulated GDD_5
  let accumulatedGDD5 = 0;
  for (let i = 0; i < allMax.length; i++) {
    const max = allMax[i] ?? 0;
    const min = allMin[i] ?? 0;
    accumulatedGDD5 += Math.max(0, (max + min) / 2 - 5);
  }

  const result: GDDData = {
    dailyMaxTemps: allMax,
    dailyMinTemps: allMin,
    dailyDates: allDates,
    accumulatedGDD5: Math.round(accumulatedGDD5),
  };

  gddCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}
