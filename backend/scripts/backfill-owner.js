'use strict';

/**
 * Assign an owner to every row that lacks one.
 *
 * Usage:
 *   node scripts/backfill-owner.js --user 1 --dry-run
 *   node scripts/backfill-owner.js --user 1
 *
 * Why the document service and not a raw UPDATE: Strapi 5 stores relations in
 * link tables (`todos_owner_lnk`), not foreign-key columns. `strapi.db.query()`
 * .updateMany() will not set a relation. `strapi.documents().update()` will, and
 * it makes no assumptions about table or column naming.
 *
 * Safe to run after the ownership middleware is installed: that middleware
 * passes through when there is no HTTP request context, and a script has none.
 * Safe to run twice: it only touches rows where owner is null.
 *
 * Run on the droplet with the production env loaded. Back up first.
 */

const OWNED_TYPES = [
  'api::todo.todo',
  // Kept in sync with OWNED_CONTENT_TYPES in src/ownership/rule.ts. `task`
  // coexists with `todo` during the todo→task migration.
  'api::task.task',
  'api::project.project',
  'api::practice-log.practice-log',
  'api::system-setting.system-setting',
];

const PAGE = 100;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function parseUserId() {
  const i = args.indexOf('--user');
  if (i === -1 || !args[i + 1]) {
    console.error('\nMissing --user <id>. Find it with: SELECT id, username FROM up_users;\n');
    process.exit(1);
  }
  const id = Number(args[i + 1]);
  if (!Number.isInteger(id) || id <= 0) {
    console.error(`\n--user must be a positive integer, got "${args[i + 1]}".\n`);
    process.exit(1);
  }
  return id;
}

async function countUnowned(strapi, uid) {
  return strapi.documents(uid).count({ filters: { owner: { id: { $null: true } } } });
}

/**
 * Page through unowned rows. We re-query each iteration rather than paginating
 * with an offset, because assigning an owner removes the row from the result
 * set — a moving window would skip half of them.
 *
 * Never called in dry-run mode: with nothing written, the result set never
 * shrinks and the loop would not terminate.
 */
async function backfillType(strapi, uid, userId) {
  let done = 0;
  for (;;) {
    const rows = await strapi.documents(uid).findMany({
      filters: { owner: { id: { $null: true } } },
      fields: ['id'],
      limit: PAGE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      await strapi.documents(uid).update({
        documentId: row.documentId,
        data: { owner: userId },
      });
      done += 1;
    }
    if (process.stdout.isTTY) process.stdout.write(`  ${uid}: ${done}\r`);
  }
  if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(60)}\r`);
  return done;
}

async function main() {
  const userId = parseUserId();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const user = await app.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
    if (!user) throw new Error(`No users-permissions user with id ${userId}.`);

    const client = app.config.get('database.connection.client');
    console.log(`\nDatabase: ${client}   Owner: ${user.username} (id ${user.id})`);
    console.log(DRY_RUN ? 'Mode: DRY RUN — nothing will be written\n' : 'Mode: WRITING\n');

    console.log('Before:');
    const before = {};
    for (const uid of OWNED_TYPES) {
      before[uid] = await countUnowned(app, uid);
      console.log(`  ${uid.padEnd(34)} ${before[uid]} unowned`);
    }
    const total = Object.values(before).reduce((a, b) => a + b, 0);
    if (total === 0) {
      console.log('\n✓ Nothing to do — no unowned rows.');
      return;
    }

    console.log(`\n${DRY_RUN ? 'Would assign' : 'Assigning'} ${total} rows to ${user.username}...`);
    for (const uid of OWNED_TYPES) {
      // In dry-run, report the counted total rather than walking pages: nothing
      // is written, so the unowned set never shrinks.
      const n = DRY_RUN ? before[uid] : await backfillType(app, uid, userId);
      console.log(`  ${uid.padEnd(34)} ${n}`.padEnd(50));
    }

    if (DRY_RUN) {
      console.log('\nDry run complete. Re-run without --dry-run to write.');
      return;
    }

    console.log('\nAfter:');
    let remaining = 0;
    for (const uid of OWNED_TYPES) {
      const n = await countUnowned(app, uid);
      remaining += n;
      console.log(`  ${uid.padEnd(34)} ${n} unowned`);
    }
    console.log(
      remaining === 0
        ? '\n✓ Zero unowned rows. Safe to deploy the ownership middleware.'
        : `\n✗ ${remaining} rows still unowned. DO NOT deploy the middleware.`
    );
    if (remaining !== 0) process.exitCode = 1;
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
