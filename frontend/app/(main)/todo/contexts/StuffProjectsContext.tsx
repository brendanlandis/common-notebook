'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  fetchStuffProjectsEnabledFromStrapi,
  ensureStuffProjectsExist,
  STUFF_PROJECTS_DEFAULT_ENABLED,
} from '@/app/lib/stuffProjectsConfig';

interface StuffProjectsContextType {
  // Whether the "stuff" world (shopping/errands/wishlist projects) is shown.
  stuffProjectsEnabled: boolean;
  setStuffProjectsEnabled: (enabled: boolean) => void;
  isLoaded: boolean;
}

const StuffProjectsContext = createContext<StuffProjectsContextType | undefined>(
  undefined
);

export function StuffProjectsProvider({ children }: { children: ReactNode }) {
  // Default to enabled so the stuff view is available until (and unless) the
  // stored setting says otherwise.
  const [stuffProjectsEnabled, setStuffProjectsEnabled] = useState<boolean>(
    STUFF_PROJECTS_DEFAULT_ENABLED
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const enabled = await fetchStuffProjectsEnabledFromStrapi();
      if (enabled !== null) {
        setStuffProjectsEnabled(enabled);
      }
      setIsLoaded(true);
    };
    load();
  }, []);

  // Whenever stuff projects are enabled (on load, or when toggled on), make sure
  // the four stuff-type projects exist for this user — creating any that are
  // missing. Idempotent, so it's a no-op once they're all present.
  useEffect(() => {
    if (isLoaded && stuffProjectsEnabled) {
      ensureStuffProjectsExist();
    }
  }, [isLoaded, stuffProjectsEnabled]);

  return (
    <StuffProjectsContext.Provider
      value={{ stuffProjectsEnabled, setStuffProjectsEnabled, isLoaded }}
    >
      {children}
    </StuffProjectsContext.Provider>
  );
}

export function useStuffProjects() {
  const context = useContext(StuffProjectsContext);
  if (context === undefined) {
    throw new Error('useStuffProjects must be used within a StuffProjectsProvider');
  }
  return context;
}
