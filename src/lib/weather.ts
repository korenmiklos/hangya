import type { HourlyWeather, WeatherResponse } from "../types";

const API_BASE = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  data: WeatherResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherResponse> {
  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
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
      "soil_moisture_0_to_1cm",
      "cloud_cover",
    ].join(","),
    daily: "temperature_2m_min,temperature_2m_mean",
    forecast_days: "5",
    past_days: "7",
    timezone: "auto",
  });

  const response = await fetch(`${API_BASE}?${params}`);
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
      soilMoisture: json.hourly.soil_moisture_0_to_1cm[i],
      cloudCover: json.hourly.cloud_cover[i],
    }),
  );

  const result: WeatherResponse = {
    hourly,
    dailyMinTemps: json.daily.temperature_2m_min,
    dailyMeanTemps: json.daily.temperature_2m_mean,
    dailyDates: json.daily.time,
  };

  cache.set(key, { data: result, timestamp: Date.now() });
  return result;
}
