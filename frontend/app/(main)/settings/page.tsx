"use client";

import { useState, useEffect } from "react";
import TimezoneManager from "@/app/components/TimezoneManager";
import FaviconManager from "@/app/components/FaviconManager";
import {
  fetchVisibilityMinutesFromStrapi,
  saveVisibilityMinutesToStrapi,
} from "@/app/lib/completedTaskVisibilityConfig";
import {
  fetchDayBoundaryHourFromStrapi,
  saveDayBoundaryHourToStrapi,
} from "@/app/lib/dayBoundaryConfig";

export default function SettingsPage() {
  const [visibilityMinutes, setVisibilityMinutes] = useState<number>(15); // Default to 15 minutes
  const [dayBoundaryHour, setDayBoundaryHour] = useState<number>(0); // Default to midnight
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      const minutes = await fetchVisibilityMinutesFromStrapi();
      if (minutes !== null) {
        setVisibilityMinutes(minutes);
      }
      const hour = await fetchDayBoundaryHourFromStrapi();
      if (hour !== null) {
        setDayBoundaryHour(hour);
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
    setVisibilityMinutes(newValue);
    setIsSaving(true);

    const success = await saveVisibilityMinutesToStrapi(newValue);
    if (!success) {
      console.error("Failed to save visibility setting");
    }

    setIsSaving(false);
  };

  const handleDayBoundaryChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newValue = parseInt(event.target.value, 10);
    setDayBoundaryHour(newValue);
    setIsSaving(true);

    const success = await saveDayBoundaryHourToStrapi(newValue);
    if (!success) {
      console.error("Failed to save day boundary setting");
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
        </section>
      </div>
    </>
  );
}
