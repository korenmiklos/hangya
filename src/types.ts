export interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  pressure: number;
  windSpeed: number;
  cloudCover: number;
}

export interface WeatherResponse {
  hourly: HourlyWeather[];
  dailyMaxTemps: number[];
  dailyMinTemps: number[];
  dailyDates: string[];
}

export interface GDDData {
  dailyMaxTemps: number[];
  dailyMinTemps: number[];
  dailyDates: string[];
  accumulatedGDD5: number;
}

export type Season = "early_spring" | "late_spring" | "peak_summer" | "late_summer";

export type Suitability = "optimal" | "acceptable" | "unsuitable";

export type FactorRating = "optimal" | "acceptable" | "unsuitable";

export interface FactorResult {
  name: string;
  displayName: string;
  value: number;
  unit: string;
  rating: FactorRating;
  category: "critical" | "primary" | "secondary";
}

export interface DailyScore {
  date: string;
  suitability: Suitability;
  season: Season;
  flightWindow: string;
  searchWindow: string;
  factors: FactorResult[];
  daylightMinutes: number;
  accumulatedGDD5: number;
}

export interface SeasonConfig {
  name: string;
  emoji: string;
  label: string;
  flightWindowStart: number;
  flightWindowEnd: number;
  searchWindowStart: string;
  searchWindowEnd: string;
  gddMin: number;
  gddMax: number;
  thresholds: SeasonThresholds;
  species: string[];
  searchTerrain: { landing: string; founding: string };
}

export interface SeasonThresholds {
  flightTemp: { optimalMin: number; optimalMax: number; acceptableMin: number; acceptableMax: number; acceptableRequiresLowClouds?: number };
  overnightLow: { optimalMin: number; optimalMax: number; acceptableMin: number; acceptableMax: number };
  humidity: { optimalMin: number; optimalMax: number; acceptableMin: number; acceptableMax: number };
  precipitation: { optimalMax: number; acceptableMax: number };
  cloudCover: { optimalMin: number; optimalMax: number; acceptableMin: number; acceptableMax: number; vetoTempThreshold?: number };
  windSpeed: { optimalMax: number; acceptableMax: number };
  prev48hPrecip: { optimalMin: number; optimalMax: number; acceptableMin: number; acceptableMax: number; droughtVetoDays?: number };
  consecDays: { threshold: number; optimalDays: number; acceptableDays: number };
}

export interface SpeciesInfo {
  scientificName: string;
  commonName?: string;
  queenSize?: string;
  lifestyle?: string;
  society?: string;
  diet?: string;
  antWikiUrl: string;
  photoUrl?: string;
}

export interface SavedLocation extends Location {
  id: string;
  alertEnabled: boolean;
  alertThreshold: number;
}

export interface AlertConfig {
  enabled: boolean;
  threshold: number;
  locationId: string;
}
