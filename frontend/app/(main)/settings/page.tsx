"use client";

import { useState, useEffect } from "react";
import TimezoneManager from "@/app/components/TimezoneManager";
import FaviconManager from "@/app/components/FaviconManager";
import { saveVisibilityMinutesToStrapi } from "@/app/lib/completedTaskVisibilityConfig";
import {
  fetchAutoDeclutterFromStrapi,
  saveAutoDeclutterToStrapi,
} from "@/app/lib/autoDeclutterConfig";
import { saveSystemSetting } from "@/app/lib/systemSettingsClient";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";

export default function SettingsPage() {
  const [autoDeclutter, setAutoDeclutter] = useState<boolean>(true); // Default on
  // The day boundary and the visibility window are owned by
  // DateTimeSettingsProvider (loaded server-side in the layout), so this page
  // edits them in place rather than keeping a second copy.
  const {
    timeZoneSettings,
    setTimeZoneSettings,
    completedTaskVisibilityMinutes,
    setCompletedTaskVisibilityMinutes,
  } = useDateTimeSettings();
  const dayBoundaryHour = timeZoneSettings.dayBoundaryHour;
  const visibilityMinutes = completedTaskVisibilityMinutes;
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      const declutter = await fetchAutoDeclutterFromStrapi();
      if (declutter !== null) {
        setAutoDeclutter(declutter);
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  // Handle change and save to database
  const handleVisibilityChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newValue = parseInt(event.target.value, 10);
    setIsSaving(true);

    const success = await saveVisibilityMinutesToStrapi(newValue);
    if (success) {
      setCompletedTaskVisibilityMinutes(newValue);
    } else {
      console.error("Failed to save visibility setting");
    }

    setIsSaving(false);
  };

  const handleDayBoundaryChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newValue = parseInt(event.target.value, 10);
    setIsSaving(true);

    const success = await saveSystemSetting("dayBoundaryHour", String(newValue));
    if (success) {
      setTimeZoneSettings({ ...timeZoneSettings, dayBoundaryHour: newValue });
    } else {
      console.error("Failed to save day boundary setting");
    }

    setIsSaving(false);
  };

  const handleAutoDeclutterChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    setAutoDeclutter(newValue);
    setIsSaving(true);

    const success = await saveAutoDeclutterToStrapi(newValue);
    if (!success) {
      console.error("Failed to save auto-declutter setting");
    }

    setIsSaving(false);
  };

  // Format hour for display (0 -> "12am", 1 -> "1am", 13 -> "1pm", etc.)
  const formatHour = (hour: number): string => {
    if (hour === 0) return "12am";
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return "12pm";
    return `${hour - 12}pm`;
  };

  return (
    <>
      <FaviconManager type="gear" />
      <div className="settings-page">
        <section className="settings-section">
          <h2>timezone</h2>
          <TimezoneManager />

          <h2>task completion</h2>
          <p>
            How long do you want tasks to stay visible after you check them off?
          </p>
          <select
            value={visibilityMinutes}
            onChange={handleVisibilityChange}
            disabled={isLoading || isSaving}
          >
            <option value="0">they should disappear right away</option>
            <option value="5">5 mins</option>
            <option value="15">15 mins</option>
            <option value="60">an hour</option>
            <option value="1440">a day</option>
          </select>

          <h2>day boundary</h2>
          <p>What time does your day start and end?</p>
          <select
            value={dayBoundaryHour}
            onChange={handleDayBoundaryChange}
            disabled={isLoading || isSaving}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatHour(i)}
              </option>
            ))}
          </select>

          <h2>Auto-Declutter</h2>
          <p>
            Should the workspace auto-refresh (remove &quot;top of mind&quot;
            flags, &quot;soon&quot; flags) every new moon?
          </p>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              className="checkbox"
              checked={autoDeclutter}
              onChange={handleAutoDeclutterChange}
              disabled={isLoading || isSaving}
            />
          </label>
        </section>
      </div>
    </>
  );
}
