'use strict';

/**
 * Seed the local dev database with two users who each own data, so tenant
 * isolation can be tested on a laptop instead of in production.
 *
 * Usage:
 *   node scripts/seed-dev.js
 *   node scripts/seed-dev.js --reset      Delete previously seeded rows first
 *   node scripts/seed-dev.js --unowned    Also create rows with no owner
 *
 * Seeded content is tagged with SEED_TAG in its title so --reset can find it.
 * Seed users are never deleted (their ids are referenced by verify-isolation.sh).
 *
 * --unowned reproduces production's pre-backfill state (rows with no owner),
 * which is the only way to exercise backfill-owner.js locally. Note that this
 * works even after the ownership middleware is installed: the middleware passes
 * through when there is no HTTP request context, and a script has none.
 *
 * Refuses to run against anything but a local SQLite database. This script
 * creates users with a published password; it must never touch production.
 */

const path = require('path');

// Load `.env` before the safety check below. Strapi loads it too, but only once
// `createStrapi()` runs — and `refuseUnlessLocalSqlite()` reads DATABASE_CLIENT
// *before* that. Without this the guard was inert on a production host, where
// DATABASE_CLIENT lives in `.env`: it read `undefined`, defaulted to 'sqlite',
// and let the script seed prod.
require('dotenv').config({
  path: process.env.ENV_PATH || path.resolve(__dirname, '..', '.env'),
});

const SEED_TAG = '[seed]';
const SEED_PASSWORD = 'seedpassword123';

/**
 * `example.com` publishes an RFC 7505 "null MX" (`0 .`), so any mail addressed
 * here is refused immediately and permanently.
 *
 * The previous `@seed.local` addresses merely failed to resolve, which relays
 * treat as a *temporary* DNS error: Forward Email queued real password-reset
 * emails and retried them for five days, bouncing DSNs into the inbox. That only
 * happened because a stray local Strapi picked up the production SMTP credentials
 * from `backend/.env` — now guarded in `config/plugins.ts` — but a seed address
 * that cannot generate a retry queue is cheap insurance.
 */
const USERS = [
  { username: 'seed_alice', email: 'alice@example.com' },
  { username: 'seed_bob', email: 'bob@example.com' },
];

const OWNED_TYPES = [
  'api::todo.todo',
  'api::project.project',
  'api::practice-log.practice-log',
  'api::system-setting.system-setting',
];

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const UNOWNED = args.includes('--unowned');

function refuseUnlessLocalSqlite() {
  const client = process.env.DATABASE_CLIENT || 'sqlite';
  const env = process.env.NODE_ENV || 'development';
  if (client !== 'sqlite' || env === 'production') {
    console.error(
      `\nRefusing to seed: DATABASE_CLIENT=${client}, NODE_ENV=${env}.\n` +
        `This script creates users with a well-known password and is for local SQLite only.\n`
    );
    process.exit(1);
  }
}

/** The document service accepts a numeric user id for a relation. */
async function ensureUser(strapi, { username, email }, roleId) {
  const existing = await strapi
    .query('plugin::users-permissions.user')
    .findOne({ where: { username } });

  if (existing) {
    // Migrate addresses left over from an earlier seed domain, so a stray send
    // can't queue against a domain that merely fails to resolve.
    if (existing.email !== email) {
      await strapi
        .query('plugin::users-permissions.user')
        .update({ where: { id: existing.id }, data: { email } });
      return { ...existing, email };
    }
    return existing;
  }

  // user.add() routes through the document service, which hashes `password`.
  return strapi.plugin('users-permissions').service('user').add({
    username,
    email,
    password: SEED_PASSWORD,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: roleId,
  });
}

/**
 * Delete everything the seed users own, plus any unowned rows.
 *
 * Deliberately keyed on ownership rather than a title tag: `practice-log` has no
 * `title` attribute (Strapi's filter validator rejects the field outright), and
 * `system-setting` titles are meaningful keys like `timezone`, not taggable.
 * Rows owned by any other user — e.g. your real account — are left alone.
 */
async function deleteSeeded(strapi, seedUserIds) {
  const filters = {
    $or: [{ owner: { id: { $in: seedUserIds } } }, { owner: { id: { $null: true } } }],
  };

  let total = 0;
  for (const uid of OWNED_TYPES) {
    // Page rather than fetch-all: deleting shrinks the result set as we go.
    for (;;) {
      const rows = await strapi.documents(uid).findMany({ filters, limit: 100 });
      if (rows.length === 0) break;
      for (const row of rows) {
        await strapi.documents(uid).delete({ documentId: row.documentId });
        total += 1;
      }
    }
  }
  return total;
}

async function seedFor(strapi, user, offset) {
  const owner = user.id;

  const project = await strapi.documents('api::project.project').create({
    data: {
      title: `${SEED_TAG} ${user.username} project`,
      world: 'make music',
      importance: 'top of mind',
      owner,
    },
  });

  // A second project so the "beyond defaultLimit" path has something to grow into.
  await strapi.documents('api::project.project').create({
    data: {
      title: `${SEED_TAG} ${user.username} side project`,
      world: 'computer',
      importance: 'normal',
      owner,
    },
  });

  const todos = [
    { title: `${SEED_TAG} ${user.username} open todo`, completed: false, soon: false },
    { title: `${SEED_TAG} ${user.username} soon todo`, completed: false, soon: true },
    { title: `${SEED_TAG} ${user.username} done todo`, completed: true, soon: false },
  ];
  for (const t of todos) {
    await strapi.documents('api::todo.todo').create({
      data: {
        ...t,
        recurrenceType: 'none',
        completedAt: t.completed ? new Date().toISOString() : null,
        project: project.documentId,
        owner,
      },
    });
  }

  const day = String(10 + offset).padStart(2, '0');
  await strapi.documents('api::practice-log.practice-log').create({
    data: {
      type: 'guitar',
      date: `2026-07-${day}`,
      start: `2026-07-${day}T14:00:00.000Z`,
      stop: `2026-07-${day}T14:45:00.000Z`,
      duration: 45,
      owner,
    },
  });

  // Per-user settings. These are the two that date logic depends on.
  const settings = [
    { title: 'timezone', value: 'America/New_York' },
    { title: 'dayBoundaryHour', value: '4' },
  ];
  for (const s of settings) {
    await strapi.documents('api::system-setting.system-setting').create({
      data: { ...s, owner },
    });
  }

  return project;
}

/**
 * Reproduce production's pre-backfill state: rows that belong to nobody.
 * Deliberately omits `owner` so backfill-owner.js has something to find.
 */
async function seedUnowned(strapi) {
  await strapi.documents('api::project.project').create({
    data: { title: `${SEED_TAG} orphan project`, world: 'life stuff', importance: 'top of mind' },
  });
  await strapi.documents('api::todo.todo').create({
    data: { title: `${SEED_TAG} orphan todo`, completed: false, recurrenceType: 'none', soon: true },
  });
  await strapi.documents('api::practice-log.practice-log').create({
    data: { type: 'voice', date: '2026-07-01', duration: 20 },
  });
  await strapi.documents('api::system-setting.system-setting').create({
    data: { title: 'moonPhaseLastResetDate', date: '2026-06-15' },
  });
  return 4;
}

async function main() {
  refuseUnlessLocalSqlite();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const role = await app
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });
    if (!role) throw new Error('No "authenticated" role found.');

    // Role permissions are seeded by bootstrap() (src/permissions), which runs
    // as part of createStrapi().load() above — including for this script.

    const users = [];
    for (const u of USERS) {
      users.push(await ensureUser(app, u, role.id));
    }

    if (RESET) {
      const n = await deleteSeeded(app, users.map((u) => u.id));
      console.log(`Reset: deleted ${n} seeded/unowned rows.`);
    }

    for (const [i, user] of users.entries()) {
      await seedFor(app, user, i);
    }

    if (UNOWNED) {
      const n = await seedUnowned(app);
      console.log(`Created ${n} unowned rows (pre-backfill state).`);
    }

    console.log('\nSeeded. Use these for verify-isolation.sh:\n');
    for (const u of users) {
      console.log(`  ${u.username.padEnd(12)} id=${u.id}  email=${u.email}`);
    }
    console.log(`\n  password (both): ${SEED_PASSWORD}`);

    // Report what each user owns, as a sanity check that owner actually stuck.
    console.log('\nOwned row counts:');
    for (const u of users) {
      const counts = [];
      for (const uid of OWNED_TYPES) {
        const n = await app.documents(uid).count({ filters: { owner: { id: { $eq: u.id } } } });
        counts.push(`${uid.split('.').pop()}=${n}`);
      }
      console.log(`  ${u.username.padEnd(12)} ${counts.join('  ')}`);
    }

    const unowned = [];
    for (const uid of OWNED_TYPES) {
      const n = await app.documents(uid).count({ filters: { owner: { id: { $null: true } } } });
      if (n > 0) unowned.push(`${uid}=${n}`);
    }
    console.log(
      unowned.length
        ? `\n⚠ Unowned rows still present: ${unowned.join(', ')} (run backfill-owner.js)`
        : '\n✓ No unowned rows.'
    );
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
