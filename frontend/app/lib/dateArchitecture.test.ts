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
 * The invariant: a `Date` in this codebase is always a real instant. Wall-clock
 * values exist only as ISO strings or hour numbers. The escape hatch that violated
 * this — date-fns-tz's `toZonedTime`, whose result is a Date with a deliberately
 * wrong epoch — is quarantined to two files, and date-fns' calendar arithmetic
 * (which reads a Date's *local* components) is quarantined to `recurrence.ts`, the
 * one place that genuinely needs wall-clock math and guards it with toWallClock.
 *
 * If Stage 8 lands and the date layer moves onto Temporal, this allowlist becomes
 * the migration checklist.
 */

const APP_DIR = resolve(__dirname, '..');

// Only these files may materialise a zoned Date via toZonedTime:
//   - dateUtils.ts:   formatInTimezone reads it straight into a string, never returns it.
//   - recurrence.ts:  toWallClock, for "2nd Tuesday of February" calendar math.
const TOZONED_ALLOWLIST = ['lib/dateUtils.ts', 'lib/recurrence.ts'];

// Only recurrence.ts may import date-fns calendar functions. `parseISO` is exempt
// everywhere: it parses a string to an instant and reads no local components.
const DATEFNS_ALLOWLIST = ['lib/recurrence.ts'];
const DATEFNS_EXEMPT_NAMES = new Set(['parseISO']);

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

  it('only the allowlist imports toZonedTime', () => {
    const offenders = FILES.filter(
      ({ rel, code }) =>
        /import[^;]*\btoZonedTime\b[^;]*from\s*['"]date-fns-tz['"]/.test(code) &&
        !TOZONED_ALLOWLIST.includes(rel)
    ).map(({ rel }) => rel);
    expect(offenders, `toZonedTime leaked outside ${TOZONED_ALLOWLIST.join(', ')}`).toEqual([]);
  });

  it('only recurrence.ts imports date-fns calendar functions (parseISO exempt)', () => {
    const offenders: string[] = [];
    for (const { rel, code } of FILES) {
      if (DATEFNS_ALLOWLIST.includes(rel)) continue;
      const m = code.match(/import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]date-fns['"]/);
      if (!m) continue;
      const names = m[1]
        .split(',')
        .map((n) => n.replace(/\s+as\s+\w+/, '').replace(/\btype\b/, '').trim())
        .filter(Boolean);
      if (names.some((n) => !DATEFNS_EXEMPT_NAMES.has(n))) offenders.push(`${rel} (${names.join(', ')})`);
    }
    expect(offenders, 'date-fns calendar functions imported outside recurrence.ts').toEqual([]);
  });

  it('getNow no longer exists anywhere', () => {
    const offenders = FILES.filter(({ code }) => /\bgetNow\b/.test(code)).map(({ rel }) => rel);
    expect(offenders, 'getNow was deleted in Stage 4 — do not reintroduce it').toEqual([]);
  });

  it('no getUTC* getter is read anywhere in the date code', () => {
    // Reading getUTCHours()/getUTCDate() off a value is the tell of the old bug:
    // a zoned Date carries the wall clock in its *local* components, so the UTC
    // getters return a shifted answer. We work in ISO strings instead.
    const offenders = FILES.filter(({ code }) =>
      /\.getUTC(Hours|Minutes|Date|Day|Month|FullYear)\s*\(/.test(code)
    ).map(({ rel }) => rel);
    expect(offenders, 'getUTC* getter found — read wall-clock values as ISO strings instead').toEqual([]);
  });
});
