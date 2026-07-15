'use client';

import { createContext, useContext, useState, useLayoutEffect, useEffect, ReactNode, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useViews } from '@/app/contexts/ViewsContext';
import { CODE_PRESETS } from '@/app/lib/views';

interface LayoutRulesetContextType {
  selectedRulesetId: string;
  setSelectedRulesetId: (id: string) => void;
  isHydrated: boolean;
}

const LayoutRulesetContext = createContext<LayoutRulesetContextType | undefined>(undefined);

const STORAGE_KEY = 'task-layout-ruleset-id';
const DEFAULT_RULESET_ID = 'good-morning';
const LAYOUT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

function getInitialRulesetId(): string {
  // On server, always return default
  if (typeof window === 'undefined') {
    return DEFAULT_RULESET_ID;
  }
  // On client, read from localStorage synchronously (validated reactively once
  // the user's views have loaded — see the effect below).
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_RULESET_ID;
  }

  try {
    const { rulesetId, timestamp } = JSON.parse(stored);
    const now = Date.now();
    if (now - timestamp < LAYOUT_EXPIRY_MS) {
      return rulesetId;
    } else {
      localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_RULESET_ID;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_RULESET_ID;
  }
}

// Internal provider that uses searchParams
function LayoutRulesetProviderInternal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Views are the source of valid ids now (was the static LAYOUT_PRESETS). The
  // two code presets (done, recurring) are always valid.
  const { views, loading: viewsLoading } = useViews();

  // Read from localStorage during initial render on client (causes hydration mismatch, but we suppress it)
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(getInitialRulesetId);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read URL parameter once on mount; after that, React state is canonical
  // and any URL changes for `view=*` are driven by the write effect below.
  // The value is taken optimistically (views may not have loaded yet) and
  // corrected by the validation effect once they have.
  useLayoutEffect(() => {
    setIsHydrated(true);

    const viewParam = searchParams.get('view');
    if (viewParam) {
      setSelectedRulesetId(viewParam);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rulesetId: viewParam, timestamp: Date.now() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once views have loaded, fall back to the default if the persisted/URL id
  // doesn't resolve to a real view or code preset (e.g. a deleted view).
  useEffect(() => {
    if (viewsLoading || !isHydrated) return;
    const valid =
      views.some((v) => v.slug === selectedRulesetId) ||
      CODE_PRESETS.some((p) => p.slug === selectedRulesetId);
    if (!valid) setSelectedRulesetId(DEFAULT_RULESET_ID);
  }, [viewsLoading, isHydrated, views, selectedRulesetId]);

  // Persist to localStorage and sync URL whenever selectedRulesetId changes (but only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rulesetId: selectedRulesetId, timestamp: Date.now() }));

      if (pathname === '/todo') {
        // Read live URL (not React's searchParams) so we don't refire on router.replace.
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
