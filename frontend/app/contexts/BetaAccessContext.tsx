'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BetaAccessContextType {
  // Whether the current user may see pages that are still "in beta".
  betaAccess: boolean;
  // False until the /api/me check resolves. Consumers must not 404 a beta page
  // (or reveal a beta menu link) while still loading.
  loading: boolean;
}

const BetaAccessContext = createContext<BetaAccessContextType | undefined>(undefined);

export function BetaAccessProvider({ children }: { children: ReactNode }) {
  // Default closed: no beta access until Strapi affirmatively grants it.
  const [betaAccess, setBetaAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/me');
        const body = await res.json();
        if (!cancelled) setBetaAccess(body?.betaAccess === true);
      } catch {
        if (!cancelled) setBetaAccess(false); // fail closed
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BetaAccessContext.Provider value={{ betaAccess, loading }}>
      {children}
    </BetaAccessContext.Provider>
  );
}

export function useBetaAccess() {
  const context = useContext(BetaAccessContext);
  if (context === undefined) {
    throw new Error('useBetaAccess must be used within a BetaAccessProvider');
  }
  return context;
}
