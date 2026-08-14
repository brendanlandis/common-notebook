import { describe, it, expect, afterEach, vi } from 'vitest';
import { canViewTransition, prefersReducedMotion as asksForLessMotion, transitionMs } from './viewTransition';

/**
 * Both branches, because both are load-bearing and neither is exercised by the
 * environment the other tests run in: jsdom implements no view transitions, so
 * without the guard every test that toggled a selection would throw on
 * `document.startViewTransition`.
 */

const original = Object.getOwnPropertyDescriptor(document, 'startViewTransition');

function supports(startViewTransition: unknown) {
  Object.defineProperty(document, 'startViewTransition', {
    value: startViewTransition,
    configurable: true,
    writable: true,
  });
}

function prefersReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as never;
}

afterEach(() => {
  if (original) Object.defineProperty(document, 'startViewTransition', original);
  else delete (document as Partial<Document>).startViewTransition;
  vi.unstubAllGlobals();
});

describe('canViewTransition', () => {
  it('is false where the API is missing', () => {
    // Firefox, and jsdom. The un-animated path is the fallback, not a failure.
    delete (document as Partial<Document>).startViewTransition;
    prefersReducedMotion(false);

    expect(canViewTransition()).toBe(false);
  });

  it('is true where it is supported and motion is welcome', () => {
    supports(() => {});
    prefersReducedMotion(false);

    expect(canViewTransition()).toBe(true);
  });

  it('is false when the reader asked for less motion', () => {
    // Things flying across the screen is precisely what that setting is about.
    // Answering it here rather than by zeroing the animation in CSS means the
    // browser never does the snapshot work either.
    supports(() => {});
    prefersReducedMotion(true);

    expect(canViewTransition()).toBe(false);
  });

  it('treats a missing matchMedia as no preference', () => {
    supports(() => {});
    (window as Partial<Window>).matchMedia = undefined;

    expect(canViewTransition()).toBe(true);
  });
});

describe('prefersReducedMotion', () => {
  it('answers without asking whether view transitions exist', () => {
    // A plain fade needs the preference and not the capability: Firefox has no
    // view transitions and can still fade something out perfectly well.
    delete (document as Partial<Document>).startViewTransition;
    prefersReducedMotion(true);
    expect(asksForLessMotion()).toBe(true);

    prefersReducedMotion(false);
    expect(asksForLessMotion()).toBe(false);
  });
});

describe('transitionMs', () => {
  const setToken = (value: string) =>
    document.documentElement.style.setProperty('--transition-time', value);

  afterEach(() => document.documentElement.style.removeProperty('--transition-time'));

  it('reads the site token in either unit', () => {
    // `450ms` is what screen.css declares; `.45s` is what a browser reports back
    // from `getComputedStyle` for the same thing, and both have shown up.
    setToken('450ms');
    expect(transitionMs()).toBe(450);

    setToken('.45s');
    expect(transitionMs()).toBe(450);
  });

  it('falls back rather than returning NaN', () => {
    // A NaN timeout fires immediately, which would silently delete the fade it
    // exists to wait for.
    setToken('');
    expect(transitionMs()).toBe(450);

    setToken('lightning');
    expect(transitionMs()).toBe(450);
  });
});
