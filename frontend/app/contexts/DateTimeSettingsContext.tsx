'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  DEFAULT_TIME_ZONE_SETTINGS,
  parseDayBoundaryHour,
  type TimeZoneSettings,
} from '@/app/lib/timeZoneSettings';
import { parseVisibilityMinutes } from '@/app/lib/completedTaskVisibilityConfig';

/**
 * Supplies the owner's date/time settings to the client tree.
 *
 * `(main)/layout.tsx` resolves these server-side and passes them as `initial`, so
 * the first paint already has the right timezone — no fetch, no flash, and no
 * localStorage copy to leak into the next user's session on a shared browser.
 *
 * Note the two shapes are deliberately not one object. `timeZoneSettings` is the
 * parameter threaded through every pure date function and resolved per-request in
 * the API routes; `completedTaskVisibilityMinutes` is read in exactly one place
 * (`useTasks`, filtering a list) and never on the server. Folding the window into
 * `TimeZoneSettings` would hand a visibility duration to `getTodayForRecurrence`
 * and make every test literal invent a value that cannot affect its assertion.
 *
 * `initial` is null only when `getAccessTokenServer()` could not resolve a token
 * (a stale one a Server Component cannot refresh — see `(main)/page.tsx`). That is
 * not "logged out", so rather than serve the defaults for the whole session we
 * fall back to fetching them the slow way, which does refresh the token.
 */
export interface DateTimeSettings {
  timeZoneSettings: TimeZoneSettings;
  completedTaskVisibilityMinutes: number;
}

interface DateTimeSettingsContextType extends DateTimeSettings {
  /** Reflect a save from /settings without a reload. */
  setTimeZoneSettings: (settings: TimeZoneSettings) => void;
  setCompletedTaskVisibilityMinutes: (minutes: number) => void;
}

const DateTimeSettingsContext = createContext<DateTimeSettingsContextType | undefined>(
  undefined
);

const DEFAULTS: DateTimeSettings = {
  timeZoneSettings: DEFAULT_TIME_ZONE_SETTINGS,
  completedTaskVisibilityMinutes: parseVisibilityMinutes(null),
};

async function fetchSetting(title: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/system-settings?title=${encodeURIComponent(title)}`);
    if (!response.ok) return null;
    const body = await response.json();
    return body.success && body.value ? String(body.value) : null;
  } catch {
    return null;
  }
}

export function DateTimeSettingsProvider({
  initial,
  children,
}: {
  initial: DateTimeSettings | null;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<DateTimeSettings>(initial ?? DEFAULTS);

  useEffect(() => {
    if (initial !== null) return;

    let cancelled = false;
    (async () => {
      const [timezone, dayBoundaryHour, visibilityMinutes] = await Promise.all([
        fetchSetting('timezone'),
        fetchSetting('dayBoundaryHour'),
        fetchSetting('completedTaskVisibilityMinutes'),
      ]);
      if (cancelled) return;
      setSettings({
        timeZoneSettings: {
          timezone: timezone || DEFAULT_TIME_ZONE_SETTINGS.timezone,
          dayBoundaryHour: parseDayBoundaryHour(dayBoundaryHour),
        },
        completedTaskVisibilityMinutes: parseVisibilityMinutes(visibilityMinutes),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [initial]);

  const setTimeZoneSettings = useCallback(
    (timeZoneSettings: TimeZoneSettings) =>
      setSettings((prev) => ({ ...prev, timeZoneSettings })),
    []
  );

  const setCompletedTaskVisibilityMinutes = useCallback(
    (completedTaskVisibilityMinutes: number) =>
      setSettings((prev) => ({ ...prev, completedTaskVisibilityMinutes })),
    []
  );

  return (
    <DateTimeSettingsContext.Provider
      value={{ ...settings, setTimeZoneSettings, setCompletedTaskVisibilityMinutes }}
    >
      {children}
    </DateTimeSettingsContext.Provider>
  );
}

export function useDateTimeSettings(): DateTimeSettingsContextType {
  const context = useContext(DateTimeSettingsContext);
  if (context === undefined) {
    throw new Error('useDateTimeSettings must be used within a DateTimeSettingsProvider');
  }
  return context;
}
