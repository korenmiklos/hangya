import { useState } from "react";
import type { Location } from "../types";
import { requestNotificationPermission } from "../lib/alerts";
import { getAlertThreshold, setAlertThreshold } from "../lib/storage";

interface Props {
  location: Location;
}

export default function AlertSettings({ location }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(getAlertThreshold());
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleToggle = async () => {
    if (!enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
    }
    setEnabled(!enabled);
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    setAlertThreshold(val);
  };

  return (
    <div className="mt-4 bg-white dark:bg-stone-900 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Alerts</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Notify when score exceeds threshold for {location.name}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            enabled ? "bg-amber-600" : "bg-stone-300 dark:bg-stone-600"
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${
              enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {permissionDenied && (
        <p className="text-xs text-red-500 mt-2">
          Notification permission denied. Please enable in browser settings.
        </p>
      )}

      {enabled && (
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-stone-500">Threshold:</label>
          <input
            type="range"
            min={20}
            max={90}
            step={5}
            value={threshold}
            onChange={(e) => handleThresholdChange(Number(e.target.value))}
            className="flex-1 accent-amber-600"
          />
          <span className="text-sm font-medium w-8">{threshold}</span>
        </div>
      )}
    </div>
  );
}
