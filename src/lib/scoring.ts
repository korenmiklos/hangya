import type {
  HourlyWeather,
  DailyScore,
  FactorResult,
  FactorRating,
  Suitability,
  WeatherResponse,
  GDDData,
  SeasonThresholds,
} from "../types";
import {
  calculateDaylength,
  getDayOfYear,
  determineSeason,
  SEASON_CONFIGS,
} from "./seasons";

// ============================================================
// Factor rating helpers
// ============================================================

function rateFlightTemp(
  temp: number,
  t: SeasonThresholds,
  cloudCover: number,
): FactorRating {
  if (temp >= t.flightTemp.optimalMin && temp <= t.flightTemp.optimalMax) {
    return "optimal";
  }
  if (temp >= t.flightTemp.acceptableMin && temp <= t.flightTemp.acceptableMax) {
    // Some seasons require low clouds for acceptable low temps
    if (
      t.flightTemp.acceptableRequiresLowClouds !== undefined &&
      temp < t.flightTemp.optimalMin &&
      cloudCover > t.flightTemp.acceptableRequiresLowClouds
    ) {
      return "unsuitable";
    }
    return "acceptable";
  }
  return "unsuitable";
}

function rateOvernightLow(low: number, t: SeasonThresholds): FactorRating {
  if (low >= t.overnightLow.optimalMin && low <= t.overnightLow.optimalMax) {
    return "optimal";
  }
  if (low >= t.overnightLow.acceptableMin && low <= t.overnightLow.acceptableMax) {
    return "acceptable";
  }
  return "unsuitable";
}

function rateHumidity(humidity: number, t: SeasonThresholds): FactorRating {
  if (humidity >= t.humidity.optimalMin && humidity <= t.humidity.optimalMax) {
    return "optimal";
  }
  if (humidity >= t.humidity.acceptableMin && humidity <= t.humidity.acceptableMax) {
    return "acceptable";
  }
  return "unsuitable";
}

function ratePrecipitation(precip: number, t: SeasonThresholds): FactorRating {
  if (precip <= t.precipitation.optimalMax) return "optimal";
  if (precip <= t.precipitation.acceptableMax) return "acceptable";
  return "unsuitable";
}

function rateCloudCover(
  cloud: number,
  temp: number,
  t: SeasonThresholds,
): FactorRating {
  if (cloud >= t.cloudCover.optimalMin && cloud <= t.cloudCover.optimalMax) {
    return "optimal";
  }
  if (cloud >= t.cloudCover.acceptableMin && cloud <= t.cloudCover.acceptableMax) {
    // Veto check for late spring: >60% clouds with temp < 19°C
    if (t.cloudCover.vetoTempThreshold !== undefined && temp < t.cloudCover.vetoTempThreshold) {
      return "unsuitable";
    }
    return "acceptable";
  }
  return "unsuitable";
}

function rateWindSpeed(wind: number, t: SeasonThresholds): FactorRating {
  if (wind <= t.windSpeed.optimalMax) return "optimal";
  if (wind <= t.windSpeed.acceptableMax) return "acceptable";
  return "unsuitable";
}

function ratePrev48hPrecip(
  precip: number,
  t: SeasonThresholds,
  droughtDays?: number,
): FactorRating {
  // Peak summer drought veto
  if (
    t.prev48hPrecip.droughtVetoDays !== undefined &&
    droughtDays !== undefined &&
    precip === 0 &&
    droughtDays > t.prev48hPrecip.droughtVetoDays
  ) {
    return "unsuitable";
  }
  if (precip >= t.prev48hPrecip.optimalMin && precip <= t.prev48hPrecip.optimalMax) {
    return "optimal";
  }
  if (precip >= t.prev48hPrecip.acceptableMin && precip <= t.prev48hPrecip.acceptableMax) {
    return "acceptable";
  }
  return "unsuitable";
}

function rateConsecDays(days: number, t: SeasonThresholds): FactorRating {
  if (days >= t.consecDays.optimalDays) return "optimal";
  if (days >= t.consecDays.acceptableDays) return "acceptable";
  return "unsuitable";
}

// ============================================================
// Data extraction helpers
// ============================================================

function getOvernightLow(
  weather: WeatherResponse,
  date: string,
): number {
  const idx = weather.dailyDates.indexOf(date);
  if (idx >= 0) return weather.dailyMinTemps[idx];
  // Fallback: find min temp from midnight to 6am
  let min = Infinity;
  for (const w of weather.hourly) {
    if (w.time.slice(0, 10) !== date) continue;
    const h = new Date(w.time).getHours();
    if (h <= 6) min = Math.min(min, w.temperature);
  }
  return min === Infinity ? 0 : min;
}

function getPrev48hPrecip(
  hourly: HourlyWeather[],
  date: string,
  flightStart: number,
): number {
  const targetTime = `${date}T${String(flightStart).padStart(2, "0")}`;
  const targetIdx = hourly.findIndex((w) => w.time.startsWith(targetTime));
  if (targetIdx < 0) return 0;

  let total = 0;
  for (let h = 1; h <= 48; h++) {
    const idx = targetIdx - h;
    if (idx < 0) break;
    total += hourly[idx].precipitation;
  }
  return Math.round(total * 10) / 10;
}

/**
 * Count consecutive days without measurable precipitation, looking backwards.
 * Used for Peak Summer drought veto (>14d drought → unsuitable if 0mm in 48h).
 */
function getDroughtDays(
  hourly: HourlyWeather[],
  date: string,
): number {
  // Group hourly precip by date, going backwards
  let droughtDays = 0;
  const dateObj = new Date(date + "T12:00:00");

  for (let d = 1; d <= 30; d++) {
    const checkDate = new Date(dateObj);
    checkDate.setDate(checkDate.getDate() - d);
    const checkStr = checkDate.toISOString().slice(0, 10);

    let dayPrecip = 0;
    for (const w of hourly) {
      if (w.time.slice(0, 10) === checkStr) {
        dayPrecip += w.precipitation;
      }
    }

    if (dayPrecip < 0.1) {
      droughtDays++;
    } else {
      break;
    }
  }
  return droughtDays;
}

function getConsecutiveDaysAbove(
  weather: WeatherResponse,
  date: string,
  threshold: number,
): number {
  const dateIdx = weather.dailyDates.indexOf(date);
  if (dateIdx < 0) return 0;

  let count = 0;
  for (let i = dateIdx - 1; i >= 0; i--) {
    if (weather.dailyMaxTemps[i] >= threshold) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ============================================================
// 2-hour block evaluation
// ============================================================

interface BlockResult {
  factors: FactorResult[];
  suitability: Suitability;
}

function evaluateBlock(
  hourlySlice: HourlyWeather[],
  overnightLow: number,
  prev48hPrecip: number,
  consecDays: number,
  droughtDays: number,
  thresholds: SeasonThresholds,
): BlockResult {
  // Average the hourly values in this 2-hour block
  const avgTemp = hourlySlice.reduce((s, w) => s + w.temperature, 0) / hourlySlice.length;
  const avgHumidity = hourlySlice.reduce((s, w) => s + w.humidity, 0) / hourlySlice.length;
  const maxPrecip = Math.max(...hourlySlice.map((w) => w.precipitation));
  const avgCloud = hourlySlice.reduce((s, w) => s + w.cloudCover, 0) / hourlySlice.length;
  const avgWind = hourlySlice.reduce((s, w) => s + w.windSpeed, 0) / hourlySlice.length;

  const factors: FactorResult[] = [
    {
      name: "flightTemp",
      displayName: "Flight Temperature",
      value: Math.round(avgTemp * 10) / 10,
      unit: "°C",
      rating: rateFlightTemp(avgTemp, thresholds, avgCloud),
      category: "primary",
    },
    {
      name: "overnightLow",
      displayName: "Overnight Low",
      value: Math.round(overnightLow * 10) / 10,
      unit: "°C",
      rating: rateOvernightLow(overnightLow, thresholds),
      category: "critical",
    },
    {
      name: "humidity",
      displayName: "Relative Humidity",
      value: Math.round(avgHumidity),
      unit: "%",
      rating: rateHumidity(avgHumidity, thresholds),
      category: "primary",
    },
    {
      name: "precipitation",
      displayName: "Precipitation",
      value: Math.round(maxPrecip * 10) / 10,
      unit: "mm/h",
      rating: ratePrecipitation(maxPrecip, thresholds),
      category: "critical",
    },
    {
      name: "cloudCover",
      displayName: "Cloud Cover",
      value: Math.round(avgCloud),
      unit: "%",
      rating: rateCloudCover(avgCloud, avgTemp, thresholds),
      category: "secondary",
    },
    {
      name: "windSpeed",
      displayName: "Wind Speed",
      value: Math.round(avgWind * 10) / 10,
      unit: "km/h",
      rating: rateWindSpeed(avgWind, thresholds),
      category: "critical",
    },
    {
      name: "prev48hPrecip",
      displayName: "Previous 48h Rainfall",
      value: prev48hPrecip,
      unit: "mm",
      rating: ratePrev48hPrecip(prev48hPrecip, thresholds, droughtDays),
      category: "secondary",
    },
    {
      name: "consecDays",
      displayName: "Consecutive Warm Days",
      value: consecDays,
      unit: consecDays === 1 ? "day" : "days",
      rating: rateConsecDays(consecDays, thresholds),
      category: "primary",
    },
  ];

  // Apply suitability matrix
  const suitability = computeSuitability(factors);
  return { factors, suitability };
}

// ============================================================
// Suitability matrix
// ============================================================

function computeSuitability(factors: FactorResult[]): Suitability {
  // If ANY factor is unsuitable → unsuitable
  if (factors.some((f) => f.rating === "unsuitable")) {
    return "unsuitable";
  }

  const critical = factors.filter((f) => f.category === "critical");
  const primary = factors.filter((f) => f.category === "primary");
  const secondary = factors.filter((f) => f.category === "secondary");

  const allCriticalOptimal = critical.every((f) => f.rating === "optimal");
  const allPrimaryOptimal = primary.every((f) => f.rating === "optimal");
  const secondaryAcceptableCount = secondary.filter((f) => f.rating === "acceptable").length;

  // Optimal: ALL critical and primary optimal, max 2 secondary acceptable
  if (allCriticalOptimal && allPrimaryOptimal && secondaryAcceptableCount <= 2) {
    return "optimal";
  }

  // Acceptable: all factors are at least acceptable (no unsuitable, already checked)
  return "acceptable";
}

// ============================================================
// Public API
// ============================================================

export function suitabilityColor(suitability: Suitability): string {
  switch (suitability) {
    case "optimal":
      return "#15803d"; // dark green
    case "acceptable":
      return "#b45309"; // amber gold
    case "unsuitable":
      return "#dc2626"; // crimson red
  }
}

export function suitabilityLabel(suitability: Suitability): string {
  switch (suitability) {
    case "optimal":
      return "Optimal";
    case "acceptable":
      return "Suitable";
    case "unsuitable":
      return "Unsuitable";
  }
}

export function ratingColor(rating: FactorRating): string {
  switch (rating) {
    case "optimal":
      return "#15803d";
    case "acceptable":
      return "#b45309";
    case "unsuitable":
      return "#dc2626";
  }
}

export function computeDailyScores(
  weather: WeatherResponse,
  gddData: GDDData,
  latitude: number,
): DailyScore[] {
  const today = new Date();
  const todayStr =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");

  const forecastDates = weather.dailyDates.filter((d) => d >= todayStr).slice(0, 5);

  return forecastDates.map((date) => {
    const d = new Date(date + "T12:00:00");
    const dayOfYear = getDayOfYear(d);
    const daylengthHours = calculateDaylength(latitude, dayOfYear);
    const daylightMinutes = Math.round(daylengthHours * 60);

    // Calculate accumulated GDD up to this date
    let gdd5ForDate = gddData.accumulatedGDD5;
    // Adjust for forecast days beyond today
    const todayIdx = gddData.dailyDates.indexOf(todayStr);
    const dateIdx = weather.dailyDates.indexOf(date);
    if (dateIdx >= 0 && todayIdx >= 0) {
      // Add forecast days' GDD
      for (let i = 0; i < weather.dailyDates.length; i++) {
        const wd = weather.dailyDates[i];
        if (wd > todayStr && wd <= date) {
          gdd5ForDate += Math.max(0, (weather.dailyMaxTemps[i] + weather.dailyMinTemps[i]) / 2 - 5);
        }
      }
    }
    gdd5ForDate = Math.round(gdd5ForDate);

    const season = determineSeason(gdd5ForDate);
    const config = SEASON_CONFIGS[season];
    const thresholds = config.thresholds;

    const flightStart = config.flightWindowStart;
    const flightEnd = config.flightWindowEnd;
    const flightWindow = `${String(flightStart).padStart(2, "0")}:00\u2013${String(flightEnd).padStart(2, "0")}:00`;
    const searchWindow = `${config.searchWindowStart}\u2013${config.searchWindowEnd}`;

    // Get context data
    const overnightLow = getOvernightLow(weather, date);
    const prev48h = getPrev48hPrecip(weather.hourly, date, flightStart);
    const consecDays = getConsecutiveDaysAbove(weather, date, thresholds.consecDays.threshold);
    const droughtDays = getDroughtDays(weather.hourly, date);

    // Collect hourly data within the flight window for this date
    const windowHourly = weather.hourly.filter((w) => {
      if (w.time.slice(0, 10) !== date) return false;
      const h = new Date(w.time).getHours();
      return h >= flightStart && h <= flightEnd;
    });

    // Find the best 2-hour contiguous block
    let bestBlock: BlockResult | null = null;

    if (windowHourly.length >= 2) {
      for (let i = 0; i <= windowHourly.length - 2; i++) {
        const slice = windowHourly.slice(i, i + 2);
        const block = evaluateBlock(slice, overnightLow, prev48h, consecDays, droughtDays, thresholds);

        if (
          !bestBlock ||
          suitabilityRank(block.suitability) > suitabilityRank(bestBlock.suitability)
        ) {
          bestBlock = block;
        }
      }
    } else if (windowHourly.length === 1) {
      // Only 1 hour available, evaluate it alone
      bestBlock = evaluateBlock(windowHourly, overnightLow, prev48h, consecDays, droughtDays, thresholds);
    }

    // Fallback if no hourly data
    if (!bestBlock) {
      const defaultFactors: FactorResult[] = [
        { name: "flightTemp", displayName: "Flight Temperature", value: 0, unit: "°C", rating: "unsuitable", category: "primary" },
        { name: "overnightLow", displayName: "Overnight Low", value: overnightLow, unit: "°C", rating: rateOvernightLow(overnightLow, thresholds), category: "critical" },
        { name: "humidity", displayName: "Relative Humidity", value: 0, unit: "%", rating: "unsuitable", category: "primary" },
        { name: "precipitation", displayName: "Precipitation", value: 0, unit: "mm/h", rating: "optimal", category: "critical" },
        { name: "cloudCover", displayName: "Cloud Cover", value: 0, unit: "%", rating: "unsuitable", category: "secondary" },
        { name: "windSpeed", displayName: "Wind Speed", value: 0, unit: "km/h", rating: "optimal", category: "critical" },
        { name: "prev48hPrecip", displayName: "Previous 48h Rainfall", value: prev48h, unit: "mm", rating: ratePrev48hPrecip(prev48h, thresholds, droughtDays), category: "secondary" },
        { name: "consecDays", displayName: "Consecutive Warm Days", value: consecDays, unit: "days", rating: rateConsecDays(consecDays, thresholds), category: "primary" },
      ];
      bestBlock = { factors: defaultFactors, suitability: "unsuitable" };
    }

    return {
      date,
      suitability: bestBlock.suitability,
      season,
      flightWindow,
      searchWindow,
      factors: bestBlock.factors,
      daylightMinutes,
      accumulatedGDD5: gdd5ForDate,
    };
  });
}

function suitabilityRank(s: Suitability): number {
  switch (s) {
    case "optimal": return 2;
    case "acceptable": return 1;
    case "unsuitable": return 0;
  }
}
