"use client";

import { useState, useEffect, useRef } from "react";
import { MapPinIcon } from "@phosphor-icons/react";
import {
  saveTimezoneToStrapi,
  setCachedTimezone,
} from "@/app/lib/timezoneConfig";
import { useTimezoneContext } from "@/app/contexts/TimezoneContext";

export default function TimezoneManager() {
  const { timezone: currentTimezone, setTimezone: setContextTimezone } = useTimezoneContext();
  const [allTimezones, setAllTimezones] = useState<
    Array<{ value: string; label: string; offset: number }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const pendingTimezoneRef = useRef<string | null>(null);

  useEffect(() => {
    // Get all available timezones and format them
    try {
      const timezones = Intl.supportedValuesOf("timeZone");
      const offsetMap = new Map<
        string,
        { value: string; label: string; offset: number }
      >();

      // Preferred cities for each offset (US cities prioritized)
      const preferredCities = new Set([
        "America/New_York", // GMT-5
        "America/Chicago", // GMT-6
        "America/Denver", // GMT-7
        "America/Los_Angeles", // GMT-8
        "America/Anchorage", // GMT-9
        "Pacific/Honolulu", // GMT-10
        "Europe/London", // GMT+0
        "Europe/Paris", // GMT+1
        "Europe/Berlin", // GMT+1
        "Asia/Tokyo", // GMT+9
        "Australia/Sydney", // GMT+10
      ]);

      // Helper function to calculate UTC offset for a timezone
      const getUTCOffset = (
        timezone: string
      ): { offsetStr: string; offset: number } => {
        const now = new Date();

        // Get the time in UTC
        const utcDate = new Date(
          now.toLocaleString("en-US", { timeZone: "UTC" })
        );

        // Get the time in the target timezone
        const tzDate = new Date(
          now.toLocaleString("en-US", { timeZone: timezone })
        );

        // Calculate offset in hours (difference between timezone and UTC)
        const offsetMinutes =
          (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
        const offsetHours = offsetMinutes / 60;

        // Format as UTC±X (keep fractional offsets like 5.5 or 5.75)
        const sign = offsetHours >= 0 ? "+" : "";
        const offsetStr = `UTC${sign}${offsetHours}`;

        return { offsetStr, offset: offsetHours };
      };

      // First pass: add preferred cities
      timezones
        .filter((tz) => preferredCities.has(tz))
        .forEach((tz) => {
          try {
            const { offsetStr, offset } = getUTCOffset(tz);

            // Get city name and check if it's a valid city (not another GMT identifier)
            const cityNameRaw = tz
              .split("/")
              .pop()
              ?.replace(/_/g, " ")
              .toLowerCase();
            const isValidCity =
              cityNameRaw && !cityNameRaw.match(/^gmt[+-]?\d+$/i);
            const label = isValidCity
              ? `${offsetStr} - ${cityNameRaw}`
              : offsetStr;

            offsetMap.set(offsetStr, { value: tz, label, offset });
          } catch (e) {
            // Ignore
          }
        });

      // Second pass: fill in any missing offsets with first available timezone
      timezones.forEach((tz) => {
        try {
          const { offsetStr, offset } = getUTCOffset(tz);

          // Only add if this offset doesn't already have a timezone
          if (!offsetMap.has(offsetStr)) {
            // Get city name and check if it's a valid city (not another GMT identifier)
            const cityNameRaw = tz
              .split("/")
              .pop()
              ?.replace(/_/g, " ")
              .toLowerCase();
            const isValidCity =
              cityNameRaw && !cityNameRaw.match(/^gmt[+-]?\d+$/i);
            const label = isValidCity
              ? `${offsetStr} - ${cityNameRaw}`
              : offsetStr;

            offsetMap.set(offsetStr, { value: tz, label, offset });
          }
        } catch (e) {
          // Ignore timezones that fail to format
        }
      });

      // Convert map to array and sort by offset
      const formatted = Array.from(offsetMap.values());
      formatted.sort((a, b) => a.offset - b.offset);

      setAllTimezones(formatted);
    } catch (e) {
      console.error("failed to load timezones:", e);
      setAllTimezones([]);
    }
  }, []);

  const handleTimezoneChange = async (timezone: string) => {
    setIsSaving(true);
    const success = await saveTimezoneToStrapi(timezone);
    if (success) {
      setContextTimezone(timezone);
    } else {
      alert("failed to save timezone. please try again.");
    }
    setIsSaving(false);
  };

  const handleAnimationIteration = () => {
    // Called at the end of each complete rotation
    if (isCompleting) {
      // Stop spinning and update UI
      setIsCompleting(false);
      if (pendingTimezoneRef.current) {
        setContextTimezone(pendingTimezoneRef.current);
        pendingTimezoneRef.current = null;
      }
    }
  };

  const handleDetectTimezone = () => {
    if (!navigator.geolocation) {
      alert("geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        let detectedTimezone: string | null = null;
        try {
          // Use the Intl API to detect timezone from the browser
          detectedTimezone =
            Intl.DateTimeFormat().resolvedOptions().timeZone;

          // Check if this timezone exists in our list
          const timezoneExists = allTimezones.some(
            (tz) => tz.value === detectedTimezone
          );

          if (timezoneExists) {
            // Save to database without updating UI yet
            const success = await saveTimezoneToStrapi(detectedTimezone);
            if (success) {
              // Store the timezone for later retrieval
              pendingTimezoneRef.current = detectedTimezone;
            } else {
              alert("failed to save timezone. please try again.");
              detectedTimezone = null;
            }
          } else {
            alert(
              `detected timezone "${detectedTimezone}" is not in the list.`
            );
            detectedTimezone = null;
          }
        } catch (error) {
          console.error("error detecting timezone:", error);
          alert("failed to detect timezone. Please select manually.");
          detectedTimezone = null;
        } finally {
          // Signal that we want to complete on the next iteration
          setIsDetecting(false);
          setIsCompleting(true);
        }
      },
      (error) => {
        console.error("geolocation error:", error);
        alert(
          "failed to get your location. please enable location permissions and try again."
        );
        setIsDetecting(false);
        setIsCompleting(true);
      }
    );
  };

  return (
    <div id="timezone-manager">
      <button
        type="button"
        onClick={handleDetectTimezone}
        className="timezone-detect-button"
        title="detect timezone"
      >
        <span 
          className={`timezone-icon-wrapper ${isDetecting ? 'detecting' : ''} ${isCompleting ? 'completing' : ''}`}
          onAnimationIteration={handleAnimationIteration}
        >
          <MapPinIcon size={24} weight={isDetecting || isCompleting ? "fill" : "regular"} />
        </span>
      </button>
      <select
        className="timezone-select"
        value={currentTimezone}
        onChange={(e) => handleTimezoneChange(e.target.value)}
        title="select timezone"
      >
        {allTimezones.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </div>
  );
}
