import type { Season, SeasonConfig, SeasonThresholds } from "../types";

// ============================================================
// Daylength calculation (astronomical)
// ============================================================

/**
 * Calculate daylength in hours for a given latitude and day of year.
 * Uses the CBM model (simplified sunrise equation).
 */
export function calculateDaylength(latitude: number, dayOfYear: number): number {
  const latRad = (latitude * Math.PI) / 180;
  // Solar declination
  const declination = -23.45 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);
  const declRad = (declination * Math.PI) / 180;

  // Hour angle at sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);

  // Handle polar day/night
  if (cosHourAngle < -1) return 24;
  if (cosHourAngle > 1) return 0;

  const hourAngle = Math.acos(cosHourAngle);
  return (2 * hourAngle * 180) / (15 * Math.PI);
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

// ============================================================
// GDD_5 calculation
// ============================================================

/**
 * Calculate daily GDD_5: Max(0, ((Temp_Max + Temp_Min) / 2) - 5)
 */
export function calculateDailyGDD5(tempMax: number, tempMin: number): number {
  return Math.max(0, (tempMax + tempMin) / 2 - 5);
}

/**
 * Calculate accumulated GDD_5 from arrays of daily max/min temps.
 */
export function calculateAccumulatedGDD5(
  dailyMaxTemps: number[],
  dailyMinTemps: number[],
): number {
  let sum = 0;
  for (let i = 0; i < dailyMaxTemps.length; i++) {
    sum += calculateDailyGDD5(dailyMaxTemps[i], dailyMinTemps[i]);
  }
  return Math.round(sum);
}

// ============================================================
// Season determination
// ============================================================

export function determineSeason(
  accumulatedGDD5: number,
): Season {
  if (accumulatedGDD5 < 200) {
    return "early_spring";
  }
  if (accumulatedGDD5 >= 200 && accumulatedGDD5 <= 700) {
    return "late_spring";
  }
  if (accumulatedGDD5 > 700 && accumulatedGDD5 <= 1600) {
    return "peak_summer";
  }
  // > 1600
  return "late_summer";
}

/**
 * Determine if daylength is rising or falling by comparing to previous day.
 */
export function isDaylengthRising(latitude: number, dayOfYear: number): boolean {
  const today = calculateDaylength(latitude, dayOfYear);
  const yesterday = calculateDaylength(latitude, dayOfYear - 1);
  return today >= yesterday;
}

// ============================================================
// Season configuration tables
// ============================================================

const earlySpringThresholds: SeasonThresholds = {
  flightTemp: { optimalMin: 14, optimalMax: 18, acceptableMin: 11, acceptableMax: 22, acceptableRequiresLowClouds: 10 },
  overnightLow: { optimalMin: 6, optimalMax: 10, acceptableMin: 2, acceptableMax: 5 },
  humidity: { optimalMin: 45, optimalMax: 60, acceptableMin: 40, acceptableMax: 70 },
  precipitation: { optimalMax: 0, acceptableMax: 0 },
  cloudCover: { optimalMin: 0, optimalMax: 10, acceptableMin: 11, acceptableMax: 30 },
  windSpeed: { optimalMax: 5, acceptableMax: 15 },
  prev48hPrecip: { optimalMin: 0, optimalMax: 5, acceptableMin: 6, acceptableMax: 10 },
  consecDays: { threshold: 12, optimalDays: 2, acceptableDays: 1 },
};

const lateSpringThresholds: SeasonThresholds = {
  flightTemp: { optimalMin: 20, optimalMax: 25, acceptableMin: 16, acceptableMax: 28, acceptableRequiresLowClouds: 20 },
  overnightLow: { optimalMin: 10, optimalMax: 15, acceptableMin: 7, acceptableMax: 9 },
  humidity: { optimalMin: 50, optimalMax: 65, acceptableMin: 45, acceptableMax: 75 },
  precipitation: { optimalMax: 0, acceptableMax: 0 },
  cloudCover: { optimalMin: 10, optimalMax: 40, acceptableMin: 41, acceptableMax: 60, vetoTempThreshold: 19 },
  windSpeed: { optimalMax: 6, acceptableMax: 15 },
  prev48hPrecip: { optimalMin: 5, optimalMax: 15, acceptableMin: 0, acceptableMax: 20 },
  consecDays: { threshold: 18, optimalDays: 3, acceptableDays: 1 },
};

const peakSummerThresholds: SeasonThresholds = {
  flightTemp: { optimalMin: 26, optimalMax: 30, acceptableMin: 24, acceptableMax: 33 },
  overnightLow: { optimalMin: 16, optimalMax: 21, acceptableMin: 14, acceptableMax: 15 },
  humidity: { optimalMin: 55, optimalMax: 75, acceptableMin: 45, acceptableMax: 85 },
  precipitation: { optimalMax: 0, acceptableMax: 0.1 },
  cloudCover: { optimalMin: 30, optimalMax: 70, acceptableMin: 0, acceptableMax: 100 },
  windSpeed: { optimalMax: 5, acceptableMax: 15 },
  prev48hPrecip: { optimalMin: 10, optimalMax: 25, acceptableMin: 0, acceptableMax: 100, droughtVetoDays: 14 },
  consecDays: { threshold: 25, optimalDays: 4, acceptableDays: 2 },
};

const lateSummerThresholds: SeasonThresholds = {
  flightTemp: { optimalMin: 20, optimalMax: 24, acceptableMin: 17, acceptableMax: 27 },
  overnightLow: { optimalMin: 10, optimalMax: 14, acceptableMin: 6, acceptableMax: 9 },
  humidity: { optimalMin: 60, optimalMax: 80, acceptableMin: 50, acceptableMax: 100 },
  precipitation: { optimalMax: 0, acceptableMax: 0 },
  cloudCover: { optimalMin: 0, optimalMax: 30, acceptableMin: 31, acceptableMax: 60 },
  windSpeed: { optimalMax: 5, acceptableMax: 15 },
  prev48hPrecip: { optimalMin: 5, optimalMax: 15, acceptableMin: 0, acceptableMax: 20 },
  consecDays: { threshold: 18, optimalDays: 2, acceptableDays: 1 },
};

export const SEASON_CONFIGS: Record<Season, SeasonConfig> = {
  early_spring: {
    name: "Early Spring",
    emoji: "🌱",
    label: "Early Spring",
    flightWindowStart: 10,
    flightWindowEnd: 14,
    searchWindowStart: "12:00",
    searchWindowEnd: "16:00",
    gddMin: 0,
    gddMax: 200,
    thresholds: earlySpringThresholds,
    species: [
      "Prenolepis nitens",
      "Messor structor",
      "Camponotus fallax",
      "Camponotus piceus",
    ],
    searchTerrain: {
      landing: "South-facing rocky slopes, sun-exposed asphalt paths, and dark stones or embankments that absorb morning heat.",
      founding: "Underside of flat stones, loose soil at the base of southern slopes, and hollow fallen twigs or oak galls.",
    },
  },
  late_spring: {
    name: "Late Spring / Pre-Summer",
    emoji: "🌸",
    label: "Late Spring \u2013 Early Summer",
    flightWindowStart: 11,
    flightWindowEnd: 16,
    searchWindowStart: "13:00",
    searchWindowEnd: "18:00",
    gddMin: 200,
    gddMax: 700,
    thresholds: lateSpringThresholds,
    species: [
      "Camponotus vagus",
      "Camponotus ligniperda",
      "Camponotus aethiops",
      "Formica rufa",
      "Formica sanguinea",
      "Manica rubida",
      "Tapinoma erraticum",
    ],
    searchTerrain: {
      landing: "Sun-exposed log piles, standing dead tree trunks, sandy forest clearings, and light-colored garden walls.",
      founding: "Deep bark crevices, beetle bore-holes in stumps, under stones in well-drained soil, and soft earth at the base of shrubs.",
    },
  },
  peak_summer: {
    name: "Peak Summer",
    emoji: "☀️",
    label: "Peak Summer",
    flightWindowStart: 15,
    flightWindowEnd: 20,
    searchWindowStart: "17:00",
    searchWindowEnd: "22:00 (+ 07:00\u201309:00 next morning)",
    gddMin: 700,
    gddMax: 1600,
    thresholds: peakSummerThresholds,
    species: [
      "Lasius niger",
      "Lasius flavus",
      "Lasius emarginatus",
      "Tetramorium caespitum",
      "Myrmica rubra",
      "Formica fusca",
    ],
    searchTerrain: {
      landing: "Light-colored urban pavements, concrete swimming pool decks, car roofs, and light-reflecting surfaces under streetlights.",
      founding: "Sidewalk cracks, damp soil at the edges of irrigated lawns, under large stones, and rotting wood or roots in shaded areas.",
    },
  },
  late_summer: {
    name: "Late Summer / Autumn",
    emoji: "🍇",
    label: "Late Summer \u2013 Early Fall",
    flightWindowStart: 13,
    flightWindowEnd: 17,
    searchWindowStart: "14:30",
    searchWindowEnd: "18:30",
    gddMin: 1600,
    gddMax: 2500,
    thresholds: lateSummerThresholds,
    species: [
      "Solenopsis fugax",
      "Crematogaster scutellaris",
      "Myrmica scabrinodis",
      "Ponera coarctata",
      "Temnothorax crassispinus",
    ],
    searchTerrain: {
      landing: "Open sandy paths through grasslands, dry dirt tracks, wooden fences, and sun-baked sheds or pergolas.",
      founding: "Fine-grained sandy soil, the periphery of existing larger ant mounds, deep cracks in dry wood, and vertical bark crevices.",
    },
  },
};
