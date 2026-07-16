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

/**
 * Supplies the owner's `TimeZoneSettings` to the client tree.
 *
 * `(main)/layout.tsx` resolves these server-side and passes them as `initial`, so
 * the first paint already has the right timezone — no fetch, no flash, and no
 * localStorage copy to leak into the next user's session on a shared browser.
 *
 * `initial` is null only when `getAccessTokenServer()` could not resolve a token
 * (a stale one a Server Component cannot refresh — see `(main)/page.tsx`). That
 * is not "logged out", so rather than serve the defaults for the whole session we
 * fall back to fetching them the slow way, which does refresh the token.
 */
interface DateTimeSettingsContextType {
  timeZoneSettings: TimeZoneSettings;
  /** Reflect a save from /settings without a reload. */
  setTimeZoneSettings: (settings: TimeZoneSettings) => void;
}

const DateTimeSettingsContext = createContext<DateTimeSettingsContextType | undefined>(undefined);

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
  initial: TimeZoneSettings | null;
  children: ReactNode;
}) {
  const [timeZoneSettings, setTimeZoneSettings] = useState<TimeZoneSettings>(
    initial ?? DEFAULT_TIME_ZONE_SETTINGS
  );

  useEffect(() => {
    if (initial !== null) return;

    let cancelled = false;
    (async () => {
      const [timezone, dayBoundaryHour] = await Promise.all([
        fetchSetting('timezone'),
        fetchSetting('dayBoundaryHour'),
      ]);
      if (cancelled) return;
      setTimeZoneSettings({
        timezone: timezone || DEFAULT_TIME_ZONE_SETTINGS.timezone,
        dayBoundaryHour: parseDayBoundaryHour(dayBoundaryHour),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [initial]);

  const update = useCallback((settings: TimeZoneSettings) => setTimeZoneSettings(settings), []);

  return (
    <DateTimeSettingsContext.Provider value={{ timeZoneSettings, setTimeZoneSettings: update }}>
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
