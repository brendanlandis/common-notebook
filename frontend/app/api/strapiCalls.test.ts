import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Guard for how handlers reach Strapi and answer failures, so a blocked or
 * deleted user's session keeps ending cleanly. `strapiFetch` is the one place a
 * 401 on a user's token becomes `SessionEndedError`, and `errorResponse` the one
 * place that turns it into a 401 clearing the cookies. A handler that builds its
 * own fetch, or its own 500, skips both: the user gets errors and empty lists for
 * up to 30 minutes instead of /login. Both shapes were everywhere until
 * 2026-09-23, which is why this is a test rather than a note.
 */

const APP_DIR = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = sourceFiles(APP_DIR).map((path) => ({ path: relative(APP_DIR, path), src: readFileSync(path, 'utf8') }));

describe('reaching Strapi', () => {
  it("sends a user's token only through strapiFetch", () => {
    // strapiAuth's logout, and the invite routes' own service token, are not user sessions ending.
    const allowed = new Set(['lib/strapiServer.ts', 'lib/strapiAuth.ts']);
    const offenders = files.flatMap(({ path, src }) =>
      [...src.matchAll(/Bearer \$\{(\w+)\}/g)]
        .filter(([, variable]) => !allowed.has(path) && variable !== 'STRAPI_INVITE_TOKEN')
        .map(([match]) => `${path}: ${match}`)
    );
    expect(offenders).toEqual([]);
  });

  it('answers a handler failure through errorResponse, not a hand-written 500', () => {
    const offenders = files
      .filter(({ path, src }) => path.startsWith('api/') && src.includes("'Internal server error'"))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
