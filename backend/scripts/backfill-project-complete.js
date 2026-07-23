'use strict';

/**
 * Backfill `project.complete = false` on every project row where it is NULL.
 *
 * The `complete` boolean was just added to the Project content type with
 * `default: false`. Strapi applies that default only to rows created *after* the
 * field exists — every pre-existing project keeps `complete = NULL`. That breaks
 * the filter the app is about to rely on: `filters[complete][$eq]=false` excludes
 * NULL rows, so without this backfill the whole existing project set (and its
 * tasks) would drop out of views the moment the `complete=false` filter ships.
 * Setting NULL → false makes `complete` never-null, so the filter stays a simple
 * two-branch form. (Same null-enum class as the projectType bug — CLAUDE.md.)
 *
 * `completedAt` is intentionally left untouched: an incomplete project has no
 * completion time. It is stamped server-side only when `complete` flips to true.
 *
 * updated_at is PRESERVED via a raw column write (see restoreUpdatedAt): a bulk
 * backfill must not reorder anything that sorts by "recently updated". (Same
 * caveat as the slownames backfill.)
 *
 * Usage:
 *   node scripts/backfill-project-complete.js --dry-run
 *   node scripts/backfill-project-complete.js                 # local (sqlite)
 *   node scripts/backfill-project-complete.js --yes           # non-sqlite (prod) — required
 *   node scripts/backfill-project-complete.js --yes --limit 1 # prove one row first
 *
 * Run on the droplet with the production env loaded, AFTER the schema deploy
 * (project gains `complete` + `completedAt`) is live. BACK UP FIRST.
 */

const PROJECT_UID = 'api::project.project';
const PROJECT_TABLE = 'projects'; // collectionName of the project content type
const PAGE = 100; // Strapi clamps list pageSize to 100; page explicitly.

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const YES = args.includes('--yes');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) : null;

/** Load every project whose `complete` is NULL, paged. */
async function loadNullCompleteProjects(strapi) {
  const all = [];
  for (let start = 0; ; start += PAGE) {
    // No `fields` restriction: restoreUpdatedAt needs the internal numeric `id`,
    // and we read `updatedAt` — mirror the proven migrate-categories template
    // rather than risk the document service omitting the primary key.
    const rows = await strapi.documents(PROJECT_UID).findMany({
      filters: { complete: { $null: true } },
      start,
      limit: PAGE,
    });
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/**
 * Restore updated_at on a project via a raw column write, bypassing the lifecycle
 * that stamps "now" — a project list can sort by updated, so the backfill must
 * not bump it. (Same caveat as the slownames backfill.)
 */
async function restoreUpdatedAt(strapi, id, updatedAt) {
  await strapi.db
    .connection(PROJECT_TABLE)
    .where({ id })
    .update({ updated_at: updatedAt ? new Date(updatedAt) : null });
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

    if (LIMIT !== null && (!Number.isInteger(LIMIT) || LIMIT <= 0)) {
      throw new Error(`--limit needs a positive integer, got "${args[limitIdx + 1]}".`);
    }

    // Guard: a real write against a non-sqlite DB (i.e. prod) needs --yes.
    if (!DRY_RUN && client !== 'sqlite' && !YES) {
      throw new Error(
        `Refusing to write to a "${client}" database without --yes. ` +
          `This looks like production. Back up first, then re-run with --yes.`
      );
    }

    const totalProjects = await app.db.query(PROJECT_UID).count();
    const nullRows = await loadNullCompleteProjects(app);
    console.log(`Total projects:        ${totalProjects}`);
    console.log(`complete IS NULL:      ${nullRows.length}`);

    if (nullRows.length === 0) {
      console.log('\n✓ Nothing to backfill — no project has a NULL `complete`.');
      return;
    }

    const toWrite = LIMIT !== null ? nullRows.slice(0, LIMIT) : nullRows;
    if (LIMIT !== null) {
      console.log(`\n--limit ${LIMIT}: writing only the first ${toWrite.length} of ${nullRows.length}.`);
    }

    if (DRY_RUN) {
      const sample = toWrite[0];
      if (sample) {
        console.log('\nSample (first row):');
        console.log(`  ${sample.documentId} "${sample.title}"  complete: NULL -> false`);
      }
      console.log(`\nWould set complete=false on ${toWrite.length} project(s) (preserving updated_at).`);
      console.log('Re-run without --dry-run to write.');
      return;
    }

    console.log(`\nSetting complete=false on ${toWrite.length} project(s)...`);
    let done = 0;
    for (const project of toWrite) {
      await app.documents(PROJECT_UID).update({
        documentId: project.documentId,
        data: { complete: false },
      });
      await restoreUpdatedAt(app, project.id, project.updatedAt);
      done += 1;
      if (process.stdout.isTTY) process.stdout.write(`  ${done}/${toWrite.length}\r`);
    }
    if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(40)}\r`);
    console.log(`\nUpdated ${done} project(s).`);

    // Verify: no project should have a NULL `complete` (unless --limit left some).
    const stillNull = await app.db.query(PROJECT_UID).count({
      where: { complete: { $null: true } },
    });
    const falseCount = await app.db.query(PROJECT_UID).count({
      where: { complete: { $eq: false } },
    });
    const trueCount = await app.db.query(PROJECT_UID).count({
      where: { complete: { $eq: true } },
    });
    const expectedRemaining = LIMIT !== null ? nullRows.length - toWrite.length : 0;

    console.log('\nPost-run counts:');
    console.log(`  complete IS NULL:    ${stillNull}  (expected ${expectedRemaining})`);
    console.log(`  complete = false:    ${falseCount}`);
    console.log(`  complete = true:     ${trueCount}`);
    console.log(`  total projects:      ${totalProjects}`);

    if (stillNull === expectedRemaining) {
      console.log('\n✓ Backfill complete. Safe to ship the `complete=false` filters.');
    } else {
      console.log(`\n✗ ${stillNull} project(s) still have NULL complete (expected ${expectedRemaining}). Investigate before deploying.`);
      process.exitCode = 1;
    }
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
