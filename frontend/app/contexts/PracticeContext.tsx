'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface PracticeContextType {
  selectedPracticeType: string;
  setSelectedPracticeType: (type: string) => void;
}

const PracticeContext = createContext<PracticeContextType | undefined>(undefined);

export function PracticeContextProvider({ children }: { children: ReactNode }) {
  const [selectedPracticeType, setSelectedPracticeType] = useState<string>('guitar');

  return (
    <PracticeContext.Provider value={{ selectedPracticeType, setSelectedPracticeType }}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const context = useContext(PracticeContext);
  if (context === undefined) {
    throw new Error('usePractice must be used within a PracticeContextProvider');
  }
  return context;
}

