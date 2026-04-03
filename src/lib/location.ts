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
