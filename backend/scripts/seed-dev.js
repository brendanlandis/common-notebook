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

const SEED_TAG = '[seed]';
const SEED_PASSWORD = 'seedpassword123';

const USERS = [
  { username: 'seed_alice', email: 'alice@seed.local' },
  { username: 'seed_bob', email: 'bob@seed.local' },
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
  if (existing) return existing;

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
 * Grant the Authenticated role CRUD on the owned types.
 *
 * The dev database ships with no `api::` permissions at all, so without this the
 * isolation test would get a 403 from Strapi's permission layer and never reach
 * the ownership middleware — a false pass. Stage 3 will seed this from
 * bootstrap() for every environment; until then, dev needs it explicitly.
 */
async function grantAuthenticatedPermissions(strapi, roleId) {
  const ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'];
  let created = 0;
  for (const uid of OWNED_TYPES) {
    for (const verb of ACTIONS) {
      const action = `${uid}.${verb}`;
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: { id: roleId } } });
      if (!existing) {
        await strapi
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: roleId } });
        created += 1;
      }
    }
  }
  return created;
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

    const granted = await grantAuthenticatedPermissions(app, role.id);
    if (granted) console.log(`Granted ${granted} Authenticated permissions on the owned types.`);

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
