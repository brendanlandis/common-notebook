'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getTimezone, fetchTimezoneFromStrapi, setCachedTimezone } from '@/app/lib/timezoneConfig';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
  isLoaded: boolean;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

const TIMEZONE_STORAGE_KEY = 'app_timezone';

// Get initial timezone from localStorage or default
function getInitialTimezone(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored) {
      setCachedTimezone(stored); // Set cache immediately
      return stored;
    }
  }
  return getTimezone();
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(getInitialTimezone);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Fetch timezone from Strapi on mount
    const loadTimezone = async () => {
      const strapiTimezone = await fetchTimezoneFromStrapi();
      if (strapiTimezone && strapiTimezone !== timezone) {
        setTimezoneState(strapiTimezone);
        setCachedTimezone(strapiTimezone);
        if (typeof window !== 'undefined') {
          localStorage.setItem(TIMEZONE_STORAGE_KEY, strapiTimezone);
        }
      }
      setIsLoaded(true);
    };

    loadTimezone();
  }, []);

  const setTimezone = (tz: string) => {
    setTimezoneState(tz);
    setCachedTimezone(tz);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
    }
  };

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, isLoaded }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezoneContext() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezoneContext must be used within a TimezoneProvider');
  }
  return context;
}

