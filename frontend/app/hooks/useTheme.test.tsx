import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

// jsdom provides neither a controllable localStorage spy nor matchMedia, so we
// stand both up per-test.

let store: Record<string, string>;

function installMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  };
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  return {
    // Simulate the OS flipping its appearance.
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
}

beforeEach(() => {
  store = {};
  global.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: () => null,
    length: 0,
  } as Storage;
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.className = '';
});

describe('useTheme', () => {
  it('defaults to system and follows the OS when no preference is stored', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('system');
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dim');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reads the legacy { theme, timestamp } shape and migrates it to a bare string', () => {
    installMatchMedia(false); // OS light; the stored choice must still win
    store['theme'] = JSON.stringify({ theme: 'dark', timestamp: Date.now() });
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('dark');
    expect(result.current.resolved).toBe('dark');
    expect(store['theme']).toBe('dark'); // rewritten to the new format
  });

  it('honors a stored light choice under a dark OS (choice is sticky, no expiry)', () => {
    installMatchMedia(true);
    store['theme'] = 'light';
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('light');
    expect(result.current.resolved).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('retro');
  });

  it('clears the override when switching to system', () => {
    installMatchMedia(false);
    store['theme'] = 'dark';
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setChoice('system'));
    expect('theme' in store).toBe(false);
    expect(result.current.choice).toBe('system');
    expect(result.current.resolved).toBe('light');
  });

  it('persists an explicit dark choice', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setChoice('dark'));
    expect(store['theme']).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dim');
  });

  it('follows OS changes live while on system', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('light');
    act(() => mm.setMatches(true));
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dim');
  });

  it('cycles system -> dark -> light -> system when the OS is light', () => {
    installMatchMedia(false); // OS light; auto shows light
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('system');
    // First click flips what auto is showing (light) -> dark.
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('dark');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('light');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('system');
  });

  it('cycles system -> light -> dark -> system when the OS is dark', () => {
    installMatchMedia(true); // OS dark; auto shows dark
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('system');
    // First click flips what auto is showing (dark) -> light.
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('light');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('dark');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('system');
  });

  it('continues the cycle from a stored explicit theme back to system', () => {
    installMatchMedia(false); // OS light
    store['theme'] = 'dark';
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('dark');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('light'); // opposite theme
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('system'); // then back to auto
  });

  it('flips first (not straight to system) when starting on the OS-matching theme', () => {
    installMatchMedia(false); // OS light; stored explicit light also shows light
    store['theme'] = 'light';
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('light');
    // First click must be visible: light -> dark, not the quiet light -> system.
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('dark');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('system');
  });

  it('flips first when starting on explicit dark under a dark OS', () => {
    installMatchMedia(true); // OS dark; stored explicit dark also shows dark
    store['theme'] = 'dark';
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('dark');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('light');
    act(() => result.current.cycleTheme());
    expect(result.current.choice).toBe('system');
  });
});
