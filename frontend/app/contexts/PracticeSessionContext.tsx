'use client';

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import type { Task } from '@/app/types/index';

/**
 * Which piece of material the practice modal is *offering* to practice.
 *
 * UI state only — the session itself lives on the server and is read through
 * `useActiveSession`. This holds the one thing the server cannot know: that you
 * clicked a practice icon on the daily page and haven't pressed play yet.
 *
 * It exists because the modal is global (mounted in the authed layout, so it can
 * cover any page) while the thing that opens it is not. A route would have been
 * the other option and was rejected: once the practice screen covers every page,
 * a `/practice/<material>` URL is a second way to express the same state, and
 * two ways to be practicing is one too many.
 */
interface PracticeSessionContextValue {
  /** The material the modal is opened *for*, before a session exists. */
  readyMaterial: Task | null;
  /** Offer to practice this. Does not start anything. */
  openFor: (material: Task) => void;
  /** Put the offer away. Has no effect on a running session. */
  dismiss: () => void;
}

const PracticeSessionContext = createContext<PracticeSessionContextValue | undefined>(
  undefined
);

export function PracticeSessionProvider({ children }: { children: ReactNode }) {
  const [readyMaterial, setReadyMaterial] = useState<Task | null>(null);

  const openFor = useCallback((material: Task) => setReadyMaterial(material), []);
  const dismiss = useCallback(() => setReadyMaterial(null), []);

  const value = useMemo(
    () => ({ readyMaterial, openFor, dismiss }),
    [readyMaterial, openFor, dismiss]
  );

  return (
    <PracticeSessionContext.Provider value={value}>{children}</PracticeSessionContext.Provider>
  );
}

export function usePracticeSessionUI() {
  const context = useContext(PracticeSessionContext);
  if (context === undefined) {
    throw new Error('usePracticeSessionUI must be used within a PracticeSessionProvider');
  }
  return context;
}
