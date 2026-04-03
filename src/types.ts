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
  soilMoisture: number;
  cloudCover: number;
}

export interface WeatherResponse {
  hourly: HourlyWeather[];
  dailyMinTemps: number[];
  dailyMeanTemps: number[];
  dailyDates: string[];
}

export type ThermalRegime = "spring" | "summer";

export interface FactorScore {
  name: string;
  value: number;
  score: number;
  ideal: string;
  unit: string;
}

export interface DailyScore {
  date: string;
  score: number;
  label: ScoreLabel;
  factors: FactorScore[];
  regime: ThermalRegime;
  flightWindow: string;
  tStar: number;
}

export type ScoreLabel =
  | "Low"
  | "Moderate"
  | "Good"
  | "Very Good"
  | "Excellent";

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
