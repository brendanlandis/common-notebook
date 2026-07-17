import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

/**
 * Architecture guard for the date layer. This is the enforcement point the timing
 * audit was missing: a paragraph in CLAUDE.md is not one, which is exactly how the
 * same class of bug shipped three times. Lint can't do this job here — eslint isn't
 * CI-gated and tsc isn't either — but the vitest suite *is* gated, so the rules live
 * as assertions that name the offending file when they trip.
 *
 * The invariant: a `Date` in this codebase is always a real instant. All zone- and
 * calendar-aware work goes through `Temporal` (ZonedDateTime / PlainDate), which
 * names its timezone explicitly and exposes the wall clock as plain integer fields.
 * The libraries that let the old footgun exist — `date-fns-tz` (`toZonedTime`, a Date
 * with a deliberately shifted epoch) and `date-fns` (calendar helpers that read a
 * Date's *machine-local* components) — are no longer imported anywhere in source.
 * These tests keep them out, so the whole bug class stays un-reintroducible.
 */

const APP_DIR = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Remove block and line comments so prose that mentions a banned name doesn't trip a rule. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = sourceFiles(APP_DIR).map((full) => ({
  rel: relative(APP_DIR, full).replace(/\\/g, '/'),
  code: stripComments(readFileSync(full, 'utf8')),
}));

describe('date layer architecture', () => {
  it('has files to check (guards against a broken walker)', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('nothing imports date-fns-tz (zone work goes through Temporal)', () => {
    const offenders = FILES.filter(({ code }) => /from\s*['"]date-fns-tz['"]/.test(code)).map(({ rel }) => rel);
    expect(offenders, 'date-fns-tz was removed — use Temporal for zone-aware dates').toEqual([]);
  });

  it('nothing imports date-fns (calendar arithmetic goes through Temporal.PlainDate)', () => {
    const offenders = FILES.filter(({ code }) => /from\s*['"]date-fns['"]/.test(code)).map(({ rel }) => rel);
    expect(offenders, 'date-fns was removed — its helpers read machine-local components').toEqual([]);
  });

  it('no toZonedTime / fromZonedTime identifier survives anywhere', () => {
    // Belt-and-braces alongside the import bans: catches a re-export or a copy-paste
    // of the zoned-Date helper regardless of where it claims to come from.
    const offenders = FILES.filter(({ code }) => /\b(toZonedTime|fromZonedTime)\b/.test(code)).map(({ rel }) => rel);
    expect(offenders, 'the zoned-Date helper is gone — do not reintroduce it').toEqual([]);
  });

  it('getNow no longer exists anywhere', () => {
    const offenders = FILES.filter(({ code }) => /\bgetNow\b/.test(code)).map(({ rel }) => rel);
    expect(offenders, 'getNow was deleted — do not reintroduce it').toEqual([]);
  });

  it('no getUTC* getter is read anywhere in the date code', () => {
    // Reading getUTCHours()/getUTCDate() off a value is the tell of the old bug:
    // a zoned Date carries the wall clock in its *local* components, so the UTC
    // getters return a shifted answer. We read wall-clock fields off Temporal instead.
    const offenders = FILES.filter(({ code }) =>
      /\.getUTC(Hours|Minutes|Date|Day|Month|FullYear)\s*\(/.test(code)
    ).map(({ rel }) => rel);
    expect(offenders, 'getUTC* getter found — read wall-clock fields off Temporal instead').toEqual([]);
  });
});
