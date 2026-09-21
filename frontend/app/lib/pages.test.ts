import { describe, it, expect } from 'vitest';
import { MAIN_PAGES, visiblePages, isTodoPath } from './pages';

describe('visiblePages', () => {
  it('shows every page to a beta user', () => {
    expect(visiblePages(true)).toEqual(['/', '/practice', '/review/daily']);
  });

  it('lists the daily review, not the review ritual', () => {
    // `/review/periodic` is reached deliberately, roughly once a cycle; the daily
    // page is the one you land on. Listing both would make the menu offer two
    // entries for what is really one feature.
    expect(MAIN_PAGES).toContain('/review/daily');
    expect(MAIN_PAGES).not.toContain('/review/periodic');
  });

  it('hides beta pages from a non-beta user', () => {
    expect(visiblePages(false)).toEqual(['/']);
  });

  it('lists only real destinations, not chrome', () => {
    expect(MAIN_PAGES).not.toContain('/settings');
  });
});

describe('isTodoPath', () => {
  it('covers home and every view, world and project', () => {
    expect(isTodoPath('/')).toBe(true);
    expect(isTodoPath('/world/music')).toBe(true);
    expect(isTodoPath('/view/done')).toBe(true);
    expect(isTodoPath('/project/abc')).toBe(true);
  });

  it('leaves other pages out', () => {
    expect(isTodoPath('/practice')).toBe(false);
    expect(isTodoPath('/review/daily')).toBe(false);
    expect(isTodoPath('/viewer')).toBe(false);
    expect(isTodoPath('/todo')).toBe(false);
  });
});
