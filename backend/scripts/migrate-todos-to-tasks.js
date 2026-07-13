'use strict';

/**
 * Copy every `todo` into the new `task` content type (the todo→task rename).
 *
 * Usage:
 *   node scripts/migrate-todos-to-tasks.js --dry-run
 *   node scripts/migrate-todos-to-tasks.js               # local (sqlite)
 *   node scripts/migrate-todos-to-tasks.js --yes         # non-sqlite (prod) — required
 *   node scripts/migrate-todos-to-tasks.js --force       # re-run into a non-empty task set
 *
 * How it works (and why):
 *  - Reads todos through the document service, unscoped: a script has no HTTP
 *    request context, so the ownership middleware passes it through (guard 2a)
 *    and every owner's rows are visible. Each task is created with the source
 *    todo's own owner — so isolation is preserved, not collapsed onto one user.
 *  - `documentId`s regenerate (a task is a new row); nothing external persists a
 *    todo documentId, so that is fine. To keep re-runs from duplicating, it
 *    REFUSES if the task set is already non-empty (override with --force).
 *  - The document service stamps createdAt/updatedAt to "now"; a todo view sorts
 *    by creationDate, so timestamps are restored with a direct column write.
 *  - Dumps all source todos to a JSON file before writing — a rollback reference.
 *
 * Run on the droplet with the production env loaded. BACK UP FIRST.
 * Coexists with `todo`: the old type and its /api/todos endpoints keep working
 * until the old content type is deleted (rename plan, Stage 6).
 */

const fs = require('fs');
const path = require('path');

const { todoToTaskData } = require('./lib/todoToTaskData');

const SOURCE_UID = 'api::todo.todo';
const TARGET_UID = 'api::task.task';
const TARGET_TABLE = 'tasks'; // collectionName of the task content type
const PAGE = 100; // Strapi clamps list pageSize to 100; page explicitly.

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const YES = args.includes('--yes');

/** Load every todo, paged, with the two relations we need to carry over. */
async function loadAllTodos(strapi) {
  const all = [];
  for (let start = 0; ; start += PAGE) {
    const rows = await strapi.documents(SOURCE_UID).findMany({
      populate: ['owner', 'project'],
      start,
      limit: PAGE,
    });
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/**
 * Restore createdAt/updatedAt/publishedAt on the freshly-created task via a raw
 * column write, bypassing the lifecycles that would otherwise stamp "now".
 * Uses JS Date objects so the Knex dialect (mysql2 on prod) formats them.
 */
async function restoreTimestamps(strapi, id, timestamps) {
  const toDate = (v) => (v ? new Date(v) : null);
  await strapi.db
    .connection(TARGET_TABLE)
    .where({ id })
    .update({
      created_at: toDate(timestamps.createdAt),
      updated_at: toDate(timestamps.updatedAt),
      published_at: toDate(timestamps.publishedAt),
    });
}

function tallyByOwner(todos) {
  const byOwner = {};
  for (const t of todos) {
    const key = t.owner?.id ?? '(none)';
    byOwner[key] = (byOwner[key] ?? 0) + 1;
  }
  return byOwner;
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const client = app.config.get('database.connection.client');
    console.log(`\nDatabase: ${client}`);
    console.log(DRY_RUN ? 'Mode: DRY RUN — nothing will be written\n' : 'Mode: WRITING\n');

    // Guard: a real write against a non-sqlite DB (i.e. prod) needs --yes.
    if (!DRY_RUN && client !== 'sqlite' && !YES) {
      throw new Error(
        `Refusing to write to a "${client}" database without --yes. ` +
          `This looks like production. Back up first, then re-run with --yes.`
      );
    }

    // Guard: don't duplicate a prior run. documentIds regenerate, so re-running
    // would create a second copy of every task.
    const existingTasks = await app.documents(TARGET_UID).count({});
    if (existingTasks > 0 && !FORCE) {
      throw new Error(
        `The task set already has ${existingTasks} row(s). Refusing to run so ` +
          `this doesn't duplicate them. Use --force only if you know it's empty of migrated data.`
      );
    }

    const todos = await loadAllTodos(app);
    console.log(`Found ${todos.length} todo(s).`);
    const sourceByOwner = tallyByOwner(todos);
    for (const [owner, n] of Object.entries(sourceByOwner)) {
      console.log(`  owner ${String(owner).padEnd(8)} ${n}`);
    }

    // Dump the source rows before writing anything — the rollback reference.
    const dumpPath = path.resolve(process.cwd(), `migrate-todos-to-tasks.dump.${Date.now()}.json`);
    fs.writeFileSync(dumpPath, JSON.stringify(todos, null, 2));
    console.log(`\nSource dump written to ${dumpPath}`);

    // Refuse to create ownerless tasks — they'd be invisible to every user.
    const orphans = todos.filter((t) => !(t.owner && t.owner.id));
    if (orphans.length > 0) {
      throw new Error(
        `${orphans.length} todo(s) have no owner (e.g. ${orphans[0].documentId}). ` +
          `Run scripts/backfill-owner.js first; migrating them would create hidden rows.`
      );
    }

    if (DRY_RUN) {
      const sample = todos[0];
      if (sample) {
        const { data, timestamps } = todoToTaskData(sample);
        console.log('\nSample mapping (first todo):');
        console.log(`  ${sample.documentId} "${sample.title}"`);
        console.log(`    owner=${data.owner} project=${data.project} createdAt=${timestamps.createdAt}`);
      }
      console.log(`\nWould create ${todos.length} task(s). Re-run without --dry-run to write.`);
      return;
    }

    console.log(`\nCreating ${todos.length} task(s)...`);
    const mapping = [];
    let done = 0;
    for (const todo of todos) {
      const { data, timestamps } = todoToTaskData(todo);
      const created = await app.documents(TARGET_UID).create({ data });
      await restoreTimestamps(app, created.id, timestamps);
      mapping.push({ from: todo.documentId, to: created.documentId, owner: data.owner });
      done += 1;
      if (process.stdout.isTTY) process.stdout.write(`  ${done}/${todos.length}\r`);
    }
    if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(40)}\r`);

    const mappingPath = path.resolve(process.cwd(), `migrate-todos-to-tasks.mapping.${Date.now()}.json`);
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

    // Verify: task count should now match the todo count, per owner.
    const taskCount = await app.documents(TARGET_UID).count({});
    console.log(`\nCreated ${done} task(s). Task set now holds ${taskCount} row(s).`);
    console.log(`Mapping written to ${mappingPath}`);
    console.log(
      taskCount === todos.length + existingTasks
        ? '\n✓ Count matches the source. Spot-check a few in the app, then deploy the frontend.'
        : `\n✗ Task count ${taskCount} != expected ${todos.length + existingTasks}. Investigate before deploying.`
    );
    if (taskCount !== todos.length + existingTasks) process.exitCode = 1;
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
