import type {
  HourlyWeather,
  DailyScore,
  FactorScore,
  ScoreLabel,
  Season,
  WeatherResponse,
} from "../types";

/**
 * Ant nuptial flight conditions (from field observations):
 *
 *                    Spring              Summer
 * Flight Time:       11:00-15:00         15:00-20:00
 * Temperature:       15-25C              24-30C
 * Daily Low:         at least 5C         irrelevant
 * Precipitation:     none                none
 * Humidity:          50-60%              at least 70%
 * Sunlight:          direct, strong      high early in day
 * Wind:              at most 10 km/h     at most 10 km/h
 * Surrounding Days:  2-3 warm days bef.  rainfall day bef/aft
 *
 * Scoring uses a smooth plateau function:
 *   - 1.0 inside [lo, hi]
 *   - 0.8 at the edges
 *   - Gaussian decay outside with configurable bandwidth
 *
 * Weather is averaged over the flight window hours for each day.
 * Daily low is taken from the daily forecast.
 */

export function getSeason(dateStr: string): Season {
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 6 && month <= 8 ? "summer" : "spring";
}

function flightWindowHours(season: Season): [number, number] {
  return season === "spring" ? [11, 15] : [15, 20];
}

function flightWindowLabel(season: Season): string {
  return season === "spring" ? "11:00-15:00" : "15:00-20:00";
}

// --- Plateau scoring primitives ---

function plateau(
  value: number,
  lo: number,
  hi: number,
  bwLo: number,
  bwHi: number,
): number {
  if (value >= lo && value <= hi) {
    const mid = (lo + hi) / 2;
    const halfWidth = (hi - lo) / 2;
    if (halfWidth === 0) return 1;
    const t = Math.abs(value - mid) / halfWidth;
    return 0.8 + 0.2 * Math.cos((t * Math.PI) / 2);
  }
  if (value < lo) {
    const d = (lo - value) / bwLo;
    return 0.8 * Math.exp(-(d * d));
  }
  const d = (value - hi) / bwHi;
  return 0.8 * Math.exp(-(d * d));
}

function plateauBelow(value: number, threshold: number, bw: number): number {
  if (value <= threshold) return 1;
  const d = (value - threshold) / bw;
  return 0.8 * Math.exp(-(d * d));
}

function plateauAbove(value: number, threshold: number, bw: number): number {
  if (value >= threshold) return 1;
  const d = (threshold - value) / bw;
  return 0.8 * Math.exp(-(d * d));
}

// --- Factor scoring ---

function scoreTemperature(temp: number, season: Season): number {
  if (season === "spring") return plateau(temp, 15, 25, 5, 5);
  return plateau(temp, 24, 30, 4, 4);
}

function scoreHumidity(humidity: number, season: Season): number {
  if (season === "spring") return plateau(humidity, 50, 60, 10, 10);
  return plateauAbove(humidity, 70, 15);
}

function scorePrecipitation(precip: number): number {
  return plateauBelow(precip, 0, 0.3);
}

function scoreWind(windSpeed: number): number {
  return plateauBelow(windSpeed, 10, 5);
}

function scoreSunlight(cloudCover: number): number {
  return plateauBelow(cloudCover, 20, 30);
}

function scoreDailyLow(dailyMin: number | null, season: Season): number {
  if (season === "summer") return 1;
  if (dailyMin === null) return 0.5;
  return plateauAbove(dailyMin, 5, 3);
}

function scoreSurroundingDays(
  hourly: HourlyWeather[],
  dayDate: string,
  season: Season,
  dailyMinTemps: number[],
  dailyDates: string[],
): number {
  if (season === "spring") {
    // Average daytime temp (10-16h) over 2 days before
    let daytimeSum = 0;
    let daytimeCount = 0;
    for (const w of hourly) {
      if (w.time.slice(0, 10) >= dayDate) break;
      const h = new Date(w.time).getHours();
      if (h >= 10 && h <= 16) {
        daytimeSum += w.temperature;
        daytimeCount++;
      }
    }
    const avgDaytimeTemp = daytimeCount > 0 ? daytimeSum / daytimeCount : 10;
    const tempScore = plateauAbove(avgDaytimeTemp, 15, 4);

    // Min daily low over previous days
    let minLow = Infinity;
    let lowCount = 0;
    for (let d = 0; d < dailyDates.length; d++) {
      if (dailyDates[d] < dayDate) {
        minLow = Math.min(minLow, dailyMinTemps[d]);
        lowCount++;
      }
    }
    const lowScore = lowCount > 0 ? plateauAbove(minLow, 5, 3) : 0.5;

    return 0.5 * tempScore + 0.5 * lowScore;
  }

  // Summer: rainfall within 24h before or after this day
  let hasRain = false;
  for (const w of hourly) {
    const wDate = w.time.slice(0, 10);
    if (wDate === dayDate) continue;
    const diffDays = Math.abs(
      (new Date(wDate).getTime() - new Date(dayDate).getTime()) / 86400000,
    );
    if (diffDays <= 1 && w.precipitation >= 0.5) {
      hasRain = true;
      break;
    }
  }
  return hasRain ? 1 : 0.3;
}

// --- Aggregation ---

interface FlightWindowAvg {
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  cloudCover: number;
  count: number;
}

function averageFlightWindow(
  hourly: HourlyWeather[],
  date: string,
  startHour: number,
  endHour: number,
): FlightWindowAvg {
  let temp = 0, hum = 0, precip = 0, wind = 0, cloud = 0, count = 0;
  for (const w of hourly) {
    if (w.time.slice(0, 10) !== date) continue;
    const h = new Date(w.time).getHours();
    if (h >= startHour && h <= endHour) {
      temp += w.temperature;
      hum += w.humidity;
      precip += w.precipitation;
      wind += w.windSpeed;
      cloud += w.cloudCover;
      count++;
    }
  }
  if (count === 0) {
    return { temperature: 0, humidity: 0, precipitation: 0, windSpeed: 0, cloudCover: 100, count: 0 };
  }
  return {
    temperature: temp / count,
    humidity: hum / count,
    precipitation: precip / count, // avg hourly precip during window
    windSpeed: wind / count,
    cloudCover: cloud / count,
    count,
  };
}

// --- Public API ---

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 40) return "Good";
  if (score >= 20) return "Moderate";
  return "Low";
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#65a30d";
  if (score >= 40) return "#ca8a04";
  if (score >= 20) return "#ea580c";
  return "#dc2626";
}

export function computeDailyScores(weather: WeatherResponse): DailyScore[] {
  const { hourly, dailyMinTemps, dailyDates } = weather;

  // Get today and 4 future days from dailyDates
  const today = new Date();
  const todayStr =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");

  const forecastDates = dailyDates.filter((d) => d >= todayStr).slice(0, 5);

  return forecastDates.map((date) => {
    const season = getSeason(date);
    const [startHour, endHour] = flightWindowHours(season);
    const avg = averageFlightWindow(hourly, date, startHour, endHour);

    const dailyIdx = dailyDates.indexOf(date);
    const dailyMin = dailyIdx >= 0 ? dailyMinTemps[dailyIdx] : null;

    const factors: FactorScore[] = [
      {
        name: "Temperature",
        value: Math.round(avg.temperature * 10) / 10,
        score: scoreTemperature(avg.temperature, season),
        ideal: season === "spring" ? "15-25" : "24-30",
        unit: "C",
      },
      {
        name: "Humidity",
        value: Math.round(avg.humidity),
        score: scoreHumidity(avg.humidity, season),
        ideal: season === "spring" ? "50-60" : "70+",
        unit: "%",
      },
      {
        name: "Precipitation",
        value: Math.round(avg.precipitation * 10) / 10,
        score: scorePrecipitation(avg.precipitation),
        ideal: "0",
        unit: "mm/h",
      },
      {
        name: "Wind",
        value: Math.round(avg.windSpeed * 10) / 10,
        score: scoreWind(avg.windSpeed),
        ideal: "0-10",
        unit: "km/h",
      },
      {
        name: "Sunlight",
        value: Math.round(avg.cloudCover),
        score: scoreSunlight(avg.cloudCover),
        ideal: "clear",
        unit: "% cloud",
      },
      {
        name: "Daily Low",
        value: dailyMin != null ? Math.round(dailyMin * 10) / 10 : -99,
        score: scoreDailyLow(dailyMin, season),
        ideal: season === "spring" ? "5+" : "n/a",
        unit: "C",
      },
      {
        name: "Prev. Days",
        value: 0,
        score: scoreSurroundingDays(hourly, date, season, dailyMinTemps, dailyDates),
        ideal: season === "spring" ? "warm streak" : "rain nearby",
        unit: "",
      },
    ];

    // Weighted geometric average: low scores have outsize influence
    // score = prod(f_i ^ w_i) where weights sum to 1
    const weights = [0.22, 0.15, 0.18, 0.13, 0.10, 0.10, 0.12];
    const logSum = factors.reduce(
      (sum, f, i) => sum + weights[i] * Math.log(Math.max(f.score, 1e-6)),
      0,
    );
    const score = Math.round(Math.exp(logSum) * 100);

    return {
      date,
      score,
      label: getScoreLabel(score),
      factors,
      season,
      flightWindow: flightWindowLabel(season),
    };
  });
}
