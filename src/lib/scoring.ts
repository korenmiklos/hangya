import type {
  HourlyWeather,
  DailyScore,
  FactorScore,
  ScoreLabel,
  ThermalRegime,
  WeatherResponse,
} from "../types";

// ============================================================
// 1. Thermal regime (replaces calendar-based season)
// ============================================================

function classifyRegime(
  date: string,
  dailyMeanTemps: number[],
  dailyDates: string[],
): ThermalRegime {
  const dateIdx = dailyDates.indexOf(date);
  if (dateIdx < 0) return "spring";

  // Mean of daily mean temps over last 5 days (inclusive of target)
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, dateIdx - 4); i <= dateIdx; i++) {
    sum += dailyMeanTemps[i];
    count++;
  }
  const tAvg5d = count > 0 ? sum / count : 10;

  if (tAvg5d >= 18) return "summer";
  return "spring"; // includes 10 <= T < 18 and cold
}

// ============================================================
// 2. Dynamic flight window
// ============================================================

function findOptimalFlightWindow(
  hourly: HourlyWeather[],
  date: string,
): { tStar: number; startHour: number; endHour: number } {
  // u(t) = temp(t) - 0.5 * wind(t) - 2.0 * precip(t)
  let bestU = -Infinity;
  let tStar = 12; // fallback

  for (const w of hourly) {
    if (w.time.slice(0, 10) !== date) continue;
    const h = new Date(w.time).getHours();
    if (h < 8 || h > 22) continue; // skip night hours
    const u = w.temperature - 0.5 * w.windSpeed - 2.0 * w.precipitation;
    if (u > bestU) {
      bestU = u;
      tStar = h;
    }
  }

  return {
    tStar,
    startHour: Math.max(0, tStar - 2),
    endHour: Math.min(23, tStar + 2),
  };
}

// ============================================================
// Scoring primitives
// ============================================================

/** Soft plateau: Gaussian tails exp(-(d/b)^2) */
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

function plateauBelowHard(value: number, threshold: number, bw: number): number {
  if (value <= threshold) return 1;
  const d = (value - threshold) / bw;
  return 0.8 * Math.exp(-(d * d * d * d));
}

function plateauAbove(value: number, threshold: number, bw: number): number {
  if (value >= threshold) return 1;
  const d = (threshold - value) / bw;
  return 0.8 * Math.exp(-(d * d));
}

// ============================================================
// 3. Precipitation: post-rain trigger
// ============================================================

/**
 * Effective recent rainfall: R = sum_{h=1}^{48} precip(t-h) * exp(-h/tau)
 * tau ≈ 6
 */
function computeEffectiveRain(
  hourly: HourlyWeather[],
  date: string,
  tStar: number,
): number {
  const targetTime = `${date}T${String(tStar).padStart(2, "0")}`;
  const targetIdx = hourly.findIndex((w) => w.time.startsWith(targetTime));
  if (targetIdx < 0) return 0;

  const tau = 6;
  let R = 0;
  for (let h = 1; h <= 48; h++) {
    const idx = targetIdx - h;
    if (idx < 0) break;
    R += hourly[idx].precipitation * Math.exp(-h / tau);
  }
  return R;
}

/**
 * Current precipitation during flight window (mean).
 * Used as a hard veto: zero out if > 0.2 mm/h.
 */
function meanPrecipInWindow(
  hourly: HourlyWeather[],
  date: string,
  startHour: number,
  endHour: number,
): number {
  let sum = 0;
  let count = 0;
  for (const w of hourly) {
    if (w.time.slice(0, 10) !== date) continue;
    const h = new Date(w.time).getHours();
    if (h >= startHour && h <= endHour) {
      sum += w.precipitation;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function scoreRainTrigger(effectiveRain: number, currentPrecip: number): number {
  // Hard veto: if raining during flight window
  if (currentPrecip > 0.2) return 0;
  // Plateau on effective rain: optimal [0.5, 3] mm
  return plateau(effectiveRain, 0.5, 3, 0.5, 2);
}

// ============================================================
// 4. Factor scoring functions
// ============================================================

// Soft: temperature
function scoreTemperature(temp: number, regime: ThermalRegime): number {
  if (regime === "spring") return plateau(temp, 13, 23, 5, 5);
  return plateau(temp, 22, 30, 4, 4);
}

// Soft: humidity (will be multiplied by rain score for interaction)
function scoreHumidity(humidity: number, regime: ThermalRegime): number {
  if (regime === "spring") return plateau(humidity, 50, 60, 10, 10);
  return plateauAbove(humidity, 70, 15);
}

// Hard: wind
function scoreWind(windSpeed: number): number {
  return plateauBelowHard(windSpeed, 10, 5);
}

// Sunlight: two-sided plateau on cloud cover [30, 70]%
function scoreSunlight(cloudCover: number): number {
  return plateau(cloudCover, 30, 70, 15, 20);
}

// Daily low (spring only)
function scoreDailyLow(dailyMin: number | null, regime: ThermalRegime): number {
  if (regime === "summer") return 1;
  if (dailyMin === null) return 0.5;
  return plateauAbove(dailyMin, 5, 3);
}

// ============================================================
// 7. Barometric pressure trend
// ============================================================

function scorePressureTrend(
  hourly: HourlyWeather[],
  date: string,
  tStar: number,
): { score: number; dP6h: number; dP24h: number } {
  const targetTime = `${date}T${String(tStar).padStart(2, "0")}`;
  const targetIdx = hourly.findIndex((w) => w.time.startsWith(targetTime));
  if (targetIdx < 0) return { score: 0.5, dP6h: 0, dP24h: 0 };

  const pNow = hourly[targetIdx].pressure;
  const p6h = targetIdx >= 6 ? hourly[targetIdx - 6].pressure : pNow;
  const p24h = targetIdx >= 24 ? hourly[targetIdx - 24].pressure : pNow;

  const dP6h = pNow - p6h; // positive = rising
  const dP24h = pNow - p24h;

  // Prefer prior drop then stabilization:
  // f = f_ge(-dP_24h; theta=2) * f_ge(dP_6h; theta=0)
  const f1 = plateauAbove(-dP24h, 2, 3); // 24h drop of at least 2 hPa
  const f2 = plateauAbove(dP6h, 0, 2);   // 6h trend stable or rising

  return { score: f1 * f2, dP6h, dP24h };
}

// ============================================================
// 8. Soil moisture
// ============================================================

function scoreSoilMoisture(soilMoisture: number): number {
  // Optimal mid-range; suppress if very dry or saturated
  // Typical range: 0.05 (dry) to 0.5 (saturated)
  return plateau(soilMoisture, 0.15, 0.35, 0.08, 0.1);
}

// ============================================================
// 6. PrevDays (extended to 3-5 days)
// ============================================================

function scoreSurroundingDays(
  hourly: HourlyWeather[],
  dayDate: string,
  regime: ThermalRegime,
  dailyMinTemps: number[],
  dailyDates: string[],
): number {
  if (regime === "spring") {
    // Average daytime temp (10-16h) over 3-5 days before
    let daytimeSum = 0;
    let daytimeCount = 0;
    for (const w of hourly) {
      const wDate = w.time.slice(0, 10);
      if (wDate >= dayDate) break;
      const diffDays =
        (new Date(dayDate).getTime() - new Date(wDate).getTime()) / 86400000;
      if (diffDays > 5) continue;
      const h = new Date(w.time).getHours();
      if (h >= 10 && h <= 16) {
        daytimeSum += w.temperature;
        daytimeCount++;
      }
    }
    const avgDaytimeTemp = daytimeCount > 0 ? daytimeSum / daytimeCount : 10;
    const tempScore = plateauAbove(avgDaytimeTemp, 15, 4);

    // Min daily low over previous 3-5 days
    let minLow = Infinity;
    let lowCount = 0;
    for (let d = 0; d < dailyDates.length; d++) {
      if (dailyDates[d] >= dayDate) continue;
      const diffDays =
        (new Date(dayDate).getTime() - new Date(dailyDates[d]).getTime()) /
        86400000;
      if (diffDays > 5) continue;
      minLow = Math.min(minLow, dailyMinTemps[d]);
      lowCount++;
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

// ============================================================
// Aggregation helpers
// ============================================================

interface FlightWindowAvg {
  temperature: number;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  soilMoisture: number;
  count: number;
}

function averageFlightWindow(
  hourly: HourlyWeather[],
  date: string,
  startHour: number,
  endHour: number,
): FlightWindowAvg {
  let temp = 0,
    hum = 0,
    wind = 0,
    cloud = 0,
    soil = 0,
    count = 0;
  for (const w of hourly) {
    if (w.time.slice(0, 10) !== date) continue;
    const h = new Date(w.time).getHours();
    if (h >= startHour && h <= endHour) {
      temp += w.temperature;
      hum += w.humidity;
      wind += w.windSpeed;
      cloud += w.cloudCover;
      soil += w.soilMoisture;
      count++;
    }
  }
  if (count === 0) {
    return {
      temperature: 0,
      humidity: 0,
      windSpeed: 0,
      cloudCover: 100,
      soilMoisture: 0.2,
      count: 0,
    };
  }
  return {
    temperature: temp / count,
    humidity: hum / count,
    windSpeed: wind / count,
    cloudCover: cloud / count,
    soilMoisture: soil / count,
    count,
  };
}

// ============================================================
// Public API
// ============================================================

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
  const { hourly, dailyMinTemps, dailyMeanTemps, dailyDates } = weather;

  const today = new Date();
  const todayStr =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");

  const forecastDates = dailyDates.filter((d) => d >= todayStr).slice(0, 5);

  return forecastDates.map((date) => {
    // 1. Thermal regime
    const regime = classifyRegime(date, dailyMeanTemps, dailyDates);

    // 2. Dynamic flight window
    const { tStar, startHour, endHour } = findOptimalFlightWindow(
      hourly,
      date,
    );
    const windowLabel = `${String(startHour).padStart(2, "0")}:00-${String(endHour).padStart(2, "0")}:00`;

    // Average weather in flight window
    const avg = averageFlightWindow(hourly, date, startHour, endHour);

    // 3. Rain trigger
    const effectiveRain = computeEffectiveRain(hourly, date, tStar);
    const currentPrecip = meanPrecipInWindow(hourly, date, startHour, endHour);
    const rainScore = scoreRainTrigger(effectiveRain, currentPrecip);

    // 5. Humidity * rain interaction
    const humidityRaw = scoreHumidity(avg.humidity, regime);
    const humidityScore = humidityRaw * Math.max(rainScore, 0.3);

    // 7. Pressure trend
    const pressure = scorePressureTrend(hourly, date, tStar);

    // 8. Soil moisture
    const soilScore = scoreSoilMoisture(avg.soilMoisture);

    // Daily low
    const dailyIdx = dailyDates.indexOf(date);
    const dailyMin = dailyIdx >= 0 ? dailyMinTemps[dailyIdx] : null;

    const factors: FactorScore[] = [
      {
        name: "Temperature",
        value: Math.round(avg.temperature * 10) / 10,
        score: scoreTemperature(avg.temperature, regime),
        ideal: regime === "spring" ? "13-23" : "22-30",
        unit: "C",
      },
      {
        name: "Rain Trigger",
        value: Math.round(effectiveRain * 10) / 10,
        score: rainScore,
        ideal: "0.5-3",
        unit: "mm eff",
      },
      {
        name: "Humidity",
        value: Math.round(avg.humidity),
        score: humidityScore,
        ideal: regime === "spring" ? "50-60" : "70+",
        unit: "%",
      },
      {
        name: "Wind",
        value: Math.round(avg.windSpeed * 10) / 10,
        score: scoreWind(avg.windSpeed),
        ideal: "0-10",
        unit: "km/h",
      },
      {
        name: "Prev. Days",
        value: 0,
        score: scoreSurroundingDays(
          hourly,
          date,
          regime,
          dailyMinTemps,
          dailyDates,
        ),
        ideal: regime === "spring" ? "warm 3-5d" : "rain nearby",
        unit: "",
      },
      {
        name: "Cloud Cover",
        value: Math.round(avg.cloudCover),
        score: scoreSunlight(avg.cloudCover),
        ideal: "30-70",
        unit: "%",
      },
      {
        name: "Daily Low",
        value: dailyMin != null ? Math.round(dailyMin * 10) / 10 : -99,
        score: scoreDailyLow(dailyMin, regime),
        ideal: regime === "spring" ? "5+" : "n/a",
        unit: "C",
      },
      {
        name: "Pressure",
        value: Math.round(pressure.dP6h * 10) / 10,
        score: pressure.score,
        ideal: "drop+stable",
        unit: "hPa/6h",
      },
      {
        name: "Soil Moist.",
        value: Math.round(avg.soilMoisture * 1000) / 1000,
        score: soilScore,
        ideal: "0.15-0.35",
        unit: "m³/m³",
      },
    ];

    // 9. Weighted geometric mean (numerical stability via log)
    // Weights: temp=0.20, rain=0.22, humidity=0.12, wind=0.15,
    //          prev_days=0.16, cloud=0.08, daily_low=0.07
    // New factors (pressure, soil) get weight from proportional scaling
    const weights = [0.17, 0.19, 0.10, 0.13, 0.14, 0.07, 0.06, 0.08, 0.06];
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
      regime,
      flightWindow: windowLabel,
      tStar,
    };
  });
}
