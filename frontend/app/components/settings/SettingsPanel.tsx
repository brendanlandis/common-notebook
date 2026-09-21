"use client";

import { useState, useEffect, type ReactNode } from "react";
import TimezoneManager from "@/app/components/settings/TimezoneManager";
import { saveVisibilityMinutesToStrapi } from "@/app/lib/completedTaskVisibilityConfig";
import {
  fetchAutoDeclutterFromStrapi,
  saveAutoDeclutterToStrapi,
} from "@/app/lib/autoDeclutterConfig";
import { saveSystemSetting } from "@/app/lib/systemSettingsClient";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useBetaAccess } from "@/app/hooks/useBetaAccess";
import { useReviewCadence } from "@/app/hooks/useReviewCadence";
import { useLocation } from "@/app/hooks/useLocation";
import RecurrencePicker from "@/app/components/ui/RecurrencePicker";
import { cadenceIsUsable } from "@/app/lib/reviewCadence";
import CalendarsManager from "@/app/components/settings/CalendarsManager";
import LogoutButton from "@/app/components/settings/LogoutButton";
import { CheckboxInput, Field, Input, Select } from "@/app/components/ui/FormControls";

export default function SettingsPanel() {
  const [autoDeclutter, setAutoDeclutter] = useState<boolean>(true); // Default on
  // The day boundary and the visibility window are owned by
  // DateTimeSettingsProvider (loaded server-side in the layout), so this panel
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

  // The review is a beta page, so its cadence is a beta setting. This is the one
  // place `useBetaAccess` is called directly rather than going through
  // BETA_PATHS — that gates whole routes, and this is a field inside a drawer
  // every user opens.
  const { betaAccess } = useBetaAccess();
  const { cadence, save: saveCadence, isSaving: isSavingCadence } = useReviewCadence();
  const { location, save: saveLocation } = useLocation();

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
    <div className="pb-8">
      <SettingsSection title="timezone">
        <TimezoneManager />
      </SettingsSection>

      <SettingsSection
        title="task completion"
        description="How long do you want tasks to stay visible after you check them off?"
      >
        <Select
          value={visibilityMinutes}
          onChange={handleVisibilityChange}
          disabled={isLoading || isSaving}
        >
          <option value="0">they should disappear right away</option>
          <option value="5">5 mins</option>
          <option value="15">15 mins</option>
          <option value="60">an hour</option>
          <option value="1440">a day</option>
        </Select>
      </SettingsSection>

      <SettingsSection
        title="day boundary"
        description="What time does your day start and end?"
      >
        {/* Addressable by id. The e2e spec used to find this by filtering for a
            select containing option value="3", on the reasoning that only the
            hour list runs 0..23 — which quietly stopped being true the moment
            another select with numeric options joined the drawer. */}
        <Select
          id="dayBoundaryHour"
          value={dayBoundaryHour}
          onChange={handleDayBoundaryChange}
          disabled={isLoading || isSaving}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>
              {formatHour(i)}
            </option>
          ))}
        </Select>
      </SettingsSection>

      <SettingsSection title="auto-declutter">
        <label className="flex cursor-pointer items-start gap-3">
          <CheckboxInput
            className="mt-0.5 shrink-0"
            checked={autoDeclutter}
            onChange={handleAutoDeclutterChange}
            disabled={isLoading || isSaving}
          />
          <span>
            Every new moon, clear the &quot;top of mind&quot; and &quot;soon&quot;
            flags.
          </span>
        </label>
      </SettingsSection>

      {betaAccess && cadence && (
        <>
          <SettingsSection
            title="review"
            description="How often do you want to sit down and plan?"
          >
            <div className="flex flex-col gap-3">
              <RecurrencePicker
                showLabels
                value={cadence}
                onChange={(next) => saveCadence({ ...cadence, ...next })}
              />

              {cadence.recurrenceType === "biweekly" && (
                <Field label="starting on" htmlFor="reviewAnchorDate">
                  <Input
                    id="reviewAnchorDate"
                    type="date"
                    value={cadence.anchorDate ?? ""}
                    disabled={isSavingCadence}
                    onChange={(e) =>
                      saveCadence({ ...cadence, anchorDate: e.target.value || null })
                    }
                  />
                </Field>
              )}

              {/* "Every other Monday" doesn't say which Monday, and a review has no
                  completed occurrence to infer the phase from the way a task does.
                  Without the anchor the cadence yields no period at all, so say so
                  here rather than let it look saved and then quietly do nothing. */}
              {!cadenceIsUsable(cadence) && (
                <p className="text-sm italic">
                  pick a start date — without one, &quot;every other&quot; doesn&apos;t say
                  which week
                </p>
              )}
            </div>
          </SettingsSection>

          {/* The only thing in this app that asks where you are, and it asks
              for the least that answers the question: two numbers, typed. No
              permission prompt, no IP lookup, nothing that keeps watching. Two
              decimal places is a few kilometres, which moves sunset by
              seconds. */}
          {location && (
            <SettingsSection
              title="where you are"
              description="Only used to work out when the sun goes down, which the daily page draws across the day."
            >
              <div className="grid grid-cols-2 gap-4">
                <Field label="latitude" htmlFor="latitude">
                  <Input
                    id="latitude"
                    type="number"
                    step="0.01"
                    min={-90}
                    max={90}
                    defaultValue={location.latitude}
                    onBlur={(e) => {
                      const latitude = Number(e.target.value);
                      if (Number.isFinite(latitude) && Math.abs(latitude) <= 90) {
                        saveLocation({ ...location, latitude });
                      }
                    }}
                  />
                </Field>
                <Field label="longitude" htmlFor="longitude">
                  <Input
                    id="longitude"
                    type="number"
                    step="0.01"
                    min={-180}
                    max={180}
                    defaultValue={location.longitude}
                    onBlur={(e) => {
                      const longitude = Number(e.target.value);
                      if (Number.isFinite(longitude) && Math.abs(longitude) <= 180) {
                        saveLocation({ ...location, longitude });
                      }
                    }}
                  />
                </Field>
              </div>
            </SettingsSection>
          )}

          <SettingsSection
            title="calendars"
            description="Paste a secret ics url per calendar. Adding them one at a time is the point — a calendar never worth a thought never gets added."
          >
            <CalendarsManager />
          </SettingsSection>
        </>
      )}

      <SettingsSection title="account">
        <LogoutButton />
      </SettingsSection>
    </div>
  );
}

/** One setting: a heading, what it's for, and its control. */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-base-content/15 py-6 first:border-t-0 first:pt-0">
      <h2 className="mt-0 mb-2 text-3xl leading-none">{title}</h2>
      {description && <p className="mb-3 text-sm opacity-75">{description}</p>}
      {children}
    </section>
  );
}
