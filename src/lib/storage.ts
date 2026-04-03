import type { SavedLocation } from "../types";

const LOCATIONS_KEY = "hangya_locations";
const ALERT_THRESHOLD_KEY = "hangya_alert_threshold";

export function getSavedLocations(): SavedLocation[] {
  const raw = localStorage.getItem(LOCATIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocation(loc: SavedLocation): void {
  const locations = getSavedLocations();
  const idx = locations.findIndex((l) => l.id === loc.id);
  if (idx >= 0) {
    locations[idx] = loc;
  } else {
    locations.push(loc);
  }
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export function removeLocation(id: string): void {
  const locations = getSavedLocations().filter((l) => l.id !== id);
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

export function getAlertThreshold(): number {
  return Number(localStorage.getItem(ALERT_THRESHOLD_KEY)) || 60;
}

export function setAlertThreshold(threshold: number): void {
  localStorage.setItem(ALERT_THRESHOLD_KEY, String(threshold));
}
