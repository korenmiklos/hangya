import type { Location } from "../types";

export function getCurrentPosition(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          name: "Current Location",
        });
      },
      (err) => {
        reject(new Error(`Geolocation error: ${err.message}`));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    );
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.display_name?.split(",")[0] ||
      "Unknown"
    );
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

export interface TownSuggestion {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Search for towns/cities by name using Nominatim.
 * Debounced to avoid excessive API calls.
 */
export function searchTown(
  query: string,
  callback: (results: TownSuggestion[]) => void,
): void {
  if (searchTimeout) clearTimeout(searchTimeout);

  if (query.length < 2) {
    callback([]);
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "5",
        addressdetails: "1",
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
      );
      const data = await res.json();
      const results: TownSuggestion[] = data.map(
        (item: {
          display_name: string;
          lat: string;
          lon: string;
          address?: { city?: string; town?: string; village?: string; country?: string };
        }) => ({
          name:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.display_name.split(",")[0],
          displayName: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }),
      );
      callback(results);
    } catch {
      callback([]);
    }
  }, 350);
}
