'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS: run
   directly with `node`, outside Next's bundler, with no dependencies. */

/**
 * Diagnose the Strapi API token used by /api/auth/redeem-invite.
 *
 * Usage (from frontend/, with the prod env on disk):
 *   node scripts/check-invite-token.js
 *
 * "Registration is unavailable" is returned from three different places in the
 * redemption route, and the user-facing message is deliberately identical in all
 * of them. This tells you which one you hit, by exercising each permission the
 * token needs — without creating an account or consuming an invite.
 *
 * No dependencies: the frontend has no `dotenv`, so `.env` is parsed here.
 */

const fs = require('fs');
const path = require('path');

/**
 * Read the same files Next.js does, in the same order, because "the token is
 * unset" is only a useful answer if we looked everywhere Next.js looks.
 *
 * Next loads, first-value-wins: the real environment, then
 * `.env.<NODE_ENV>.local`, `.env.local`, `.env.<NODE_ENV>`, `.env`.
 * A production droplet may keep the token in any of them — or in the process
 * manager's environment, in which case only the shell we run under has it.
 *
 * ENV_PATH overrides the search with a single file (used by the tests).
 */
const sourceOf = {}; // key -> where it came from, for the report

function readEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // first wins
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    sourceOf[key] = path.basename(file);
  }
}

const KEYS = ['STRAPI_API_URL', 'STRAPI_INVITE_TOKEN'];
for (const key of KEYS) {
  if (process.env[key] !== undefined) sourceOf[key] = 'the environment';
}

const root = path.resolve(__dirname, '..');
const searched = process.env.ENV_PATH
  ? [process.env.ENV_PATH]
  : [
      `.env.${process.env.NODE_ENV || 'production'}.local`,
      '.env.local',
      `.env.${process.env.NODE_ENV || 'production'}`,
      '.env',
    ].map((f) => path.resolve(root, f));

searched.forEach(readEnvFile);

const STRAPI = (process.env.STRAPI_API_URL || '').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_INVITE_TOKEN;

const auth = () => ({ Authorization: `Bearer ${TOKEN}` });

async function status(method, path, body) {
  try {
    const response = await fetch(`${STRAPI}${path}`, {
      method,
      headers: body ? { ...auth(), 'Content-Type': 'application/json' } : auth(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.status;
  } catch (error) {
    return `network error: ${error.message}`;
  }
}

/**
 * Each check maps a permission to a request that proves it, and to a status that
 * means "you have it". A 403 always means the scope is missing.
 *
 * `user.create` is probed with an empty body: with the permission you get a 400
 * validation error, without it a 403. Nothing is created either way. Same trick
 * for `invite.update` against a documentId that cannot exist.
 */
const CHECKS = [
  {
    scope: 'Invite: find',
    run: () => status('GET', '/api/invites?pagination[pageSize]=1'),
    ok: (s) => s === 200,
  },
  {
    scope: 'Users-permissions Role: find',
    run: () => status('GET', '/api/users-permissions/roles'),
    ok: (s) => s === 200,
  },
  {
    scope: 'Users-permissions User: create',
    run: () => status('POST', '/api/users', {}),
    ok: (s) => s === 400, // validation failed = we were allowed to try
  },
  {
    scope: 'Invite: update',
    run: () => status('PUT', '/api/invites/definitelynotarealdocumentid', { data: { usedAt: null } }),
    ok: (s) => s === 404, // not found = we were allowed to try
  },
];

const from = (key) => (sourceOf[key] ? ` (from ${sourceOf[key]})` : '');

async function main() {
  console.log('\nInvite token configuration');
  console.log(`  STRAPI_API_URL       ${STRAPI || '(unset)'}${from('STRAPI_API_URL')}`);
  console.log(
    `  STRAPI_INVITE_TOKEN  ${TOKEN ? `set, ${TOKEN.length} chars` : '(unset)'}${from('STRAPI_INVITE_TOKEN')}`
  );

  if (!STRAPI) {
    console.error('\n✗ STRAPI_API_URL is unset.\n');
    process.exit(1);
  }
  if (!TOKEN) {
    console.error(
      '\n✗ STRAPI_INVITE_TOKEN is unset — nothing in the environment, and nothing in:\n' +
        searched.map((f) => `      ${f}`).join('\n') +
        '\n\n  This is why registration answers "Registration is unavailable" (503).\n' +
        '  Note that only an *unset* token produces that message: a wrong or revoked\n' +
        '  token makes the invite lookup fail instead, and you would see "That invite\n' +
        '  code is not valid" (400).\n\n' +
        '  It belongs in the FRONTEND environment, on the host running Next.js — never\n' +
        '  NEXT_PUBLIC_, and not in backend/.env. `frontend/.env` is gitignored, so a\n' +
        '  token added on your laptop never travels to the droplet with the repo.\n\n' +
        '  If Next.js runs under a process manager, the variable must be exported into\n' +
        '  *its* environment; a `.env` file only works if Next.js starts in this directory.\n'
    );
    process.exit(1);
  }

  console.log(`\nPermissions on this token:`);
  const results = [];
  for (const check of CHECKS) {
    const result = await check.run();
    const passed = check.ok(result);
    results.push({ ...check, result, passed });
    const detail = passed ? 'granted' : result === 403 ? 'MISSING (403)' : `unexpected: ${result}`;
    console.log(`  ${passed ? '✓' : '✗'} ${check.scope.padEnd(32)} ${detail}`);
  }

  if (results.every((r) => r.passed)) {
    console.log('\n✓ The token has every scope redemption needs.');
    console.log('  If registration still fails, check the Next.js server logs — the third');
    console.log('  "Registration is unavailable" comes from a failed invite update.\n');
    return;
  }

  // Strapi answers 401 before it ever consults permissions, so *every* check
  // failing that way means the token string itself is not recognised — not that
  // scopes are missing. Deleting and recreating a token in the admin UI changes
  // its value, and the old one keeps sitting in the frontend env looking correct.
  if (results.every((r) => r.result === 401)) {
    console.error(
      '\n✗ Strapi rejected the token itself (401 on every request), so its scopes\n' +
        '  were never consulted. The value in STRAPI_INVITE_TOKEN does not match any\n' +
        '  token in Strapi — it was regenerated, revoked, expired, or truncated.\n\n' +
        '  Strapi admin → Settings → API Tokens shows the tokens that exist. A token\n' +
        "  value is displayed exactly once, when created; if it's lost, regenerate and\n" +
        '  copy the new value into the frontend environment.\n'
    );
    process.exit(1);
  }

  console.error(
    '\n✗ Fix in Strapi admin → Settings → API Tokens → your token (type: Custom).\n' +
      '  It needs exactly: Invite find + update, Users-permissions User create,\n' +
      '  Users-permissions Role find. Nothing else.\n\n' +
      '  Regenerating a token changes its value — update the frontend env too.\n'
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
