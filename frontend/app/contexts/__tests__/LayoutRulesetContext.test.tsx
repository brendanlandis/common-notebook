import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LayoutRulesetProvider, useLayoutRuleset } from '../LayoutRulesetContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
}));

// Mock layout presets
vi.mock('@/app/lib/layoutPresets', () => ({
  LAYOUT_PRESETS: [
    { id: 'good-morning', name: 'good morning' },
    { id: 'roulette', name: 'roulette' },
    { id: 'stuff', name: 'stuff' },
    { id: 'done', name: 'done' },
  ],
}));

describe('LayoutRulesetContext', () => {
  let mockRouter: any;
  let mockSearchParams: any;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock = {};
    
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    } as Storage;

    // Mock router
    mockRouter = {
      replace: vi.fn(),
      push: vi.fn(),
    };

    // Mock searchParams
    mockSearchParams = {
      get: vi.fn(() => null),
      toString: vi.fn(() => ''),
    };

    vi.mocked(useRouter).mockReturnValue(mockRouter);
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams as any);
    vi.mocked(usePathname).mockReturnValue('/todo');

    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <LayoutRulesetProvider>{children}</LayoutRulesetProvider>
  );

  describe('Initial state', () => {
    it('should initialize with default preset when no localStorage or URL param', () => {
      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });
      
      expect(result.current.selectedRulesetId).toBe('good-morning');
      // isHydrated runs synchronously in test environment via useLayoutEffect
      expect(result.current.isHydrated).toBe(true);
    });

    it('should initialize with localStorage value when present and not expired', () => {
      const layoutData = {
        rulesetId: 'roulette',
        timestamp: Date.now(),
      };
      localStorageMock['todo-layout-ruleset-id'] = JSON.stringify(layoutData);

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });
      
      expect(result.current.selectedRulesetId).toBe('roulette');
    });

    it('should ignore expired localStorage value', () => {
      const expiredLayoutData = {
        rulesetId: 'roulette',
        timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago (expired)
      };
      localStorageMock['todo-layout-ruleset-id'] = JSON.stringify(expiredLayoutData);

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });
      
      expect(result.current.selectedRulesetId).toBe('good-morning');
      expect(localStorage.removeItem).toHaveBeenCalledWith('todo-layout-ruleset-id');
    });

    it('should use valid URL parameter over localStorage', async () => {
      const layoutData = {
        rulesetId: 'roulette',
        timestamp: Date.now(),
      };
      localStorageMock['todo-layout-ruleset-id'] = JSON.stringify(layoutData);
      
      mockSearchParams.get.mockReturnValue('stuff');

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      await waitFor(() => {
        expect(result.current.selectedRulesetId).toBe('stuff');
      });
    });

    it('should ignore invalid URL parameter and use localStorage', async () => {
      const layoutData = {
        rulesetId: 'roulette',
        timestamp: Date.now(),
      };
      localStorageMock['todo-layout-ruleset-id'] = JSON.stringify(layoutData);
      
      mockSearchParams.get.mockReturnValue('invalid-preset');

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      await waitFor(() => {
        expect(result.current.selectedRulesetId).toBe('roulette');
      });
    });
  });

  describe('Changing selectedRulesetId', () => {
    it('should update localStorage when selectedRulesetId changes', async () => {
      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      act(() => {
        result.current.setSelectedRulesetId('stuff');
      });

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'todo-layout-ruleset-id',
          expect.stringContaining('"rulesetId":"stuff"')
        );
      });
    });

    it('should update URL when selectedRulesetId changes on /todo page', async () => {
      window.location.search = '';
      vi.mocked(usePathname).mockReturnValue('/todo');

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      act(() => {
        result.current.setSelectedRulesetId('roulette');
      });

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          '/todo?view=roulette',
          { scroll: false }
        );
      });
    });

    it('should not update URL when on different page', async () => {
      vi.mocked(usePathname).mockReturnValue('/practice');

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      act(() => {
        result.current.setSelectedRulesetId('roulette');
      });

      // Wait a bit to ensure no URL update happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should not update URL when view parameter already matches', async () => {
      window.location.search = '?view=stuff';
      vi.mocked(usePathname).mockReturnValue('/todo');

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      // Try to set to the same value that's already in the URL
      act(() => {
        result.current.setSelectedRulesetId('stuff');
      });

      // The initial hydration might call replace, but after that it shouldn't
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should only be called during initial hydration, not again
      const replaceCalls = mockRouter.replace.mock.calls;
      const stuffCalls = replaceCalls.filter((call: any) => 
        call[0] === '/todo?view=stuff'
      );
      
      // Should be called at most once (during hydration)
      expect(stuffCalls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Hydration', () => {
    it('should set isHydrated to true after mount', () => {
      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      // In test environment with jsdom, useLayoutEffect runs synchronously
      // so isHydrated is immediately true
      expect(result.current.isHydrated).toBe(true);
    });

    it('should persist to localStorage after state changes', async () => {
      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      // In test environment, hydration happens synchronously
      expect(result.current.isHydrated).toBe(true);

      // Change state after hydration
      act(() => {
        result.current.setSelectedRulesetId('stuff');
      });

      // Should persist to localStorage
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'todo-layout-ruleset-id',
          expect.stringContaining('"rulesetId":"stuff"')
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON in localStorage', () => {
      localStorageMock['todo-layout-ruleset-id'] = 'invalid-json';

      const { result } = renderHook(() => useLayoutRuleset(), { wrapper });

      expect(result.current.selectedRulesetId).toBe('good-morning');
      expect(localStorage.removeItem).toHaveBeenCalledWith('todo-layout-ruleset-id');
    });

    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useLayoutRuleset());
      }).toThrow('useLayoutRuleset must be used within a LayoutRulesetProvider');
    });
  });
});
