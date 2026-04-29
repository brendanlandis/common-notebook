'use client';

import { createContext, useContext, useState, useLayoutEffect, useEffect, ReactNode, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { LAYOUT_PRESETS } from '@/app/lib/layoutPresets';

interface LayoutRulesetContextType {
  selectedRulesetId: string;
  setSelectedRulesetId: (id: string) => void;
  isHydrated: boolean;
}

const LayoutRulesetContext = createContext<LayoutRulesetContextType | undefined>(undefined);

const STORAGE_KEY = 'todo-layout-ruleset-id';
const DEFAULT_RULESET_ID = 'good-morning';
const LAYOUT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper to validate preset ID
function isValidPresetId(id: string): boolean {
  return LAYOUT_PRESETS.some(preset => preset.id === id);
}

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

// Internal provider that uses searchParams
function LayoutRulesetProviderInternal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Read from localStorage during initial render on client (causes hydration mismatch, but we suppress it)
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(getInitialRulesetId);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read URL parameter once on mount; after that, React state is canonical
  // and any URL changes for `view=*` are driven by the write effect below.
  useLayoutEffect(() => {
    setIsHydrated(true);

    const viewParam = searchParams.get('view');
    if (viewParam && isValidPresetId(viewParam)) {
      setSelectedRulesetId(viewParam);
      const layoutData = {
        rulesetId: viewParam,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage and sync URL whenever selectedRulesetId changes (but only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      const layoutData = {
        rulesetId: selectedRulesetId,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutData));

      if (pathname === '/todo') {
        // Read live URL (not React's searchParams) so we don't refire on router.replace.
        // Safe because the read effect above only runs once on mount, so this can't loop.
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.set('view', selectedRulesetId);
        router.replace(`${pathname}?${currentParams.toString()}`, { scroll: false });
      }
    }
  }, [selectedRulesetId, isHydrated, pathname, router]);

  return (
    <LayoutRulesetContext.Provider value={{ selectedRulesetId, setSelectedRulesetId, isHydrated }}>
      {children}
    </LayoutRulesetContext.Provider>
  );
}

// Wrapper with Suspense boundary for Next.js static generation
export function LayoutRulesetProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <LayoutRulesetProviderInternal>{children}</LayoutRulesetProviderInternal>
    </Suspense>
  );
}

export function useLayoutRuleset() {
  const context = useContext(LayoutRulesetContext);
  if (context === undefined) {
    throw new Error('useLayoutRuleset must be used within a LayoutRulesetProvider');
  }
  return context;
}

