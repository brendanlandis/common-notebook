'use client';

import { createContext, useContext, useState, useLayoutEffect, useEffect, ReactNode } from 'react';

interface LayoutRulesetContextType {
  selectedRulesetId: string;
  setSelectedRulesetId: (id: string) => void;
  isHydrated: boolean;
}

const LayoutRulesetContext = createContext<LayoutRulesetContextType | undefined>(undefined);

const STORAGE_KEY = 'todo-layout-ruleset-id';
const DEFAULT_RULESET_ID = 'good-morning';
const LAYOUT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

function getInitialRulesetId(): string {
  // On server, always return default
  if (typeof window === 'undefined') {
    return DEFAULT_RULESET_ID;
  }
  // On client, read from localStorage synchronously
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_RULESET_ID;
  }
  
  try {
    const { rulesetId, timestamp } = JSON.parse(stored);
    const now = Date.now();
    
    // Check if the saved preference has expired (older than 5 minutes)
    if (now - timestamp < LAYOUT_EXPIRY_MS) {
      return rulesetId;
    } else {
      // Preference expired, reset to default
      localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_RULESET_ID;
    }
  } catch (e) {
    // If parsing fails (old format), fall back to default
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_RULESET_ID;
  }
}

export function LayoutRulesetProvider({ children }: { children: ReactNode }) {
  // Read from localStorage during initial render on client (causes hydration mismatch, but we suppress it)
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(getInitialRulesetId);
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated synchronously before paint (client-side only)
  useLayoutEffect(() => {
    setIsHydrated(true);
  }, []);

  // Persist to localStorage whenever selectedRulesetId changes (but only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      const layoutData = {
        rulesetId: selectedRulesetId,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutData));
    }
  }, [selectedRulesetId, isHydrated]);

  return (
    <LayoutRulesetContext.Provider value={{ selectedRulesetId, setSelectedRulesetId, isHydrated }}>
      {children}
    </LayoutRulesetContext.Provider>
  );
}

export function useLayoutRuleset() {
  const context = useContext(LayoutRulesetContext);
  if (context === undefined) {
    throw new Error('useLayoutRuleset must be used within a LayoutRulesetProvider');
  }
  return context;
}

