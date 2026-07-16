import { describe, it, expect, vi } from 'vitest';
import { MAIN_PAGES, visiblePages, soleDestination } from './pages';

describe('visiblePages', () => {
  it('shows every page to a beta user', () => {
    expect(visiblePages(true)).toEqual(['/todo', '/practice']);
  });

  it('hides beta pages from a non-beta user', () => {
    expect(visiblePages(false)).toEqual(['/todo']);
  });

  it('lists only real destinations, not chrome', () => {
    expect(MAIN_PAGES).not.toContain('/');
    expect(MAIN_PAGES).not.toContain('/settings');
  });
});

describe('soleDestination', () => {
  it('returns /todo when it is a non-beta user’s only page', () => {
    expect(soleDestination(false)).toBe('/todo');
  });

  it('returns null when the user has a choice of pages', () => {
    expect(soleDestination(true)).toBeNull();
  });

  it('never returns / — redirecting to the result cannot loop', () => {
    expect(soleDestination(true)).not.toBe('/');
    expect(soleDestination(false)).not.toBe('/');
  });

  it('returns null rather than a destination when no pages are visible', async () => {
    // The empty case is unreachable with today's constants (/todo is never beta),
    // so force it: with every page beta, a non-beta user can see nothing at all.
    // `length === 1` must not quietly become a stand-in for "not empty".
    vi.resetModules();
    vi.doMock('./betaConfig', () => ({ isBetaPath: () => true }));
    const pages = await import('./pages');

    expect(pages.visiblePages(false)).toEqual([]);
    expect(pages.soleDestination(false)).toBeNull();

    vi.doUnmock('./betaConfig');
    vi.resetModules();
  });
});
