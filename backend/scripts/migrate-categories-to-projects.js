'use strict';

/**
 * Convert the task `category` enum into real projects (the categories→projects
 * refactor). Each category becomes a project carrying the new `projectType`:
 *   - the 8 "chore" categories → projects in their mapped world, projectType "chores"
 *   - the 4 "stuff" categories → projects in the new "stuff" world, projectType
 *     matching the category value (wishlist / errands / in the mail / buy stuff)
 *
 * For every owner that has category-tagged, project-less tasks, the needed
 * projects are created (once) and those tasks are repointed onto them.
 *
 * IMPORTANT: this KEEPS the `category` value on each task. Adding a project is
 * backward-compatible — the *old* frontend groups by project when one is present
 * and still reads category, so it keeps working after this runs; the *new*
 * frontend reads `project.projectType`. `category` is nulled and removed only in
 * Stage 6, after the new frontend is deployed and verified.
 *
 * Usage:
 *   node scripts/migrate-categories-to-projects.js --dry-run
 *   node scripts/migrate-categories-to-projects.js               # local (sqlite)
 *   node scripts/migrate-categories-to-projects.js --yes         # non-sqlite (prod) — required
 *   node scripts/migrate-categories-to-projects.js --yes --limit 1  # prove one task first
 *
 * Run on the droplet with the production env loaded, AFTER the schema deploy
 * (project.world gains "stuff"; project gains projectType) is live. BACK UP FIRST.
 */

const fs = require('fs');
const path = require('path');

const TASK_UID = 'api::task.task';
const PROJECT_UID = 'api::project.project';
const TASK_TABLE = 'tasks'; // collectionName of the task content type
const PAGE = 100; // Strapi clamps list pageSize to 100; page explicitly.

// category value -> the project it becomes. Worlds mirror the old getTaskWorld
// mapping; stuff categories move into the new "stuff" world.
const CATEGORY_TO_PROJECT = {
  'home chores': { world: 'life stuff', projectType: 'chores' },
  'life chores': { world: 'life stuff', projectType: 'chores' },
  'studio chores': { world: 'music admin', projectType: 'chores' },
  'band chores': { world: 'music admin', projectType: 'chores' },
  'work chores': { world: 'day job', projectType: 'chores' },
  'web chores': { world: 'computer', projectType: 'chores' },
  'data chores': { world: 'computer', projectType: 'chores' },
  'computer chores': { world: 'computer', projectType: 'chores' },
  'in the mail': { world: 'stuff', projectType: 'in the mail' },
  'buy stuff': { world: 'stuff', projectType: 'buy stuff' },
  'wishlist': { world: 'stuff', projectType: 'wishlist' },
  'errands': { world: 'stuff', projectType: 'errands' },
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const YES = args.includes('--yes');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) : null;

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Load every task that has a category but no project, paged, with owner. */
async function loadCategoryTasks(strapi) {
  const all = [];
  for (let start = 0; ; start += PAGE) {
    const rows = await strapi.documents(TASK_UID).findMany({
      filters: { category: { $notNull: true }, project: { id: { $null: true } } },
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
 * Restore updated_at on a task via a raw column write, bypassing the lifecycle
 * that stamps "now" — a task view can sort by updated, so repointing must not
 * bump it. (Same caveat as the slownames backfill.)
 */
async function restoreUpdatedAt(strapi, id, updatedAt) {
  await strapi.db
    .connection(TASK_TABLE)
    .where({ id })
    .update({ updated_at: updatedAt ? new Date(updatedAt) : null });
}

/**
 * Find or create the project for (owner, category). Idempotent: matches an
 * existing project by owner + title so a re-run reuses it instead of duplicating.
 */
async function ensureProject(strapi, ownerId, category, cache) {
  const key = `${ownerId}::${category}`;
  if (cache.has(key)) return cache.get(key);

  const spec = CATEGORY_TO_PROJECT[category];
  const title = category; // project title mirrors the category name

  const existing = await strapi.documents(PROJECT_UID).findMany({
    filters: { title: { $eq: title }, owner: { id: { $eq: ownerId } } },
    populate: ['owner'],
    limit: 1,
  });

  let project = existing[0];
  if (!project) {
    project = await strapi.documents(PROJECT_UID).create({
      data: {
        title,
        slug: slugify(title),
        description: [],
        world: spec.world,
        projectType: spec.projectType,
        importance: 'normal',
        owner: ownerId,
      },
    });
  }
  cache.set(key, project);
  return project;
}

function tallyBy(rows, keyFn) {
  const by = {};
  for (const r of rows) {
    const key = keyFn(r);
    by[key] = (by[key] ?? 0) + 1;
  }
  return by;
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

    const tasks = await loadCategoryTasks(app);
    console.log(`Found ${tasks.length} category-tagged, project-less task(s).`);

    // Refuse to migrate ownerless tasks — the project would be ownerless/hidden.
    const orphans = tasks.filter((t) => !(t.owner && t.owner.id));
    if (orphans.length > 0) {
      throw new Error(
        `${orphans.length} task(s) have no owner (e.g. ${orphans[0].documentId}). ` +
          `Run scripts/backfill-owner.js first.`
      );
    }

    // Refuse any unknown category value so nothing is silently skipped.
    const unknown = tasks.filter((t) => !CATEGORY_TO_PROJECT[t.category]);
    if (unknown.length > 0) {
      const values = [...new Set(unknown.map((t) => t.category))];
      throw new Error(`Unknown category value(s): ${values.join(', ')}. Update CATEGORY_TO_PROJECT.`);
    }

    const byCategory = tallyBy(tasks, (t) => t.category);
    for (const [cat, n] of Object.entries(byCategory)) {
      console.log(`  ${cat.padEnd(16)} ${n}`);
    }

    const toMigrate = LIMIT !== null ? tasks.slice(0, LIMIT) : tasks;
    if (LIMIT !== null) {
      console.log(`\n--limit ${LIMIT}: migrating only the first ${toMigrate.length} of ${tasks.length}.`);
    }

    // Dump the source rows (documentId, owner, category, updatedAt) before writing.
    const dumpPath = path.resolve(process.cwd(), `migrate-categories-to-projects.dump.${Date.now()}.json`);
    fs.writeFileSync(
      dumpPath,
      JSON.stringify(
        toMigrate.map((t) => ({
          documentId: t.documentId,
          owner: t.owner.id,
          category: t.category,
          updatedAt: t.updatedAt,
        })),
        null,
        2
      )
    );
    console.log(`\nSource dump written to ${dumpPath}`);

    if (DRY_RUN) {
      const sample = toMigrate[0];
      if (sample) {
        const spec = CATEGORY_TO_PROJECT[sample.category];
        console.log('\nSample mapping (first task):');
        console.log(`  ${sample.documentId} "${sample.title}" category=${sample.category}`);
        console.log(`    -> project "${sample.category}" world=${spec.world} projectType=${spec.projectType}`);
      }
      console.log(`\nWould repoint ${toMigrate.length} task(s) onto ${Object.keys(byCategory).length} project type(s) per owner.`);
      console.log('Re-run without --dry-run to write.');
      return;
    }

    console.log(`\nRepointing ${toMigrate.length} task(s)...`);
    const projectCache = new Map();
    const mapping = [];
    let done = 0;
    for (const task of toMigrate) {
      const project = await ensureProject(app, task.owner.id, task.category, projectCache);
      // Repoint the task onto the project (keeping its category value).
      await app.documents(TASK_UID).update({
        documentId: task.documentId,
        data: { project: project.id },
      });
      await restoreUpdatedAt(app, task.id, task.updatedAt);
      mapping.push({ task: task.documentId, category: task.category, project: project.documentId });
      done += 1;
      if (process.stdout.isTTY) process.stdout.write(`  ${done}/${toMigrate.length}\r`);
    }
    if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(40)}\r`);

    const mappingPath = path.resolve(process.cwd(), `migrate-categories-to-projects.mapping.${Date.now()}.json`);
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`\nRepointed ${done} task(s). Mapping written to ${mappingPath}`);

    // Verify: every migrated task now has a project.
    const stillUnlinked = await app.db.query(TASK_UID).count({
      where: { category: { $notNull: true }, project: { id: { $null: true } } },
    });
    const remaining = LIMIT !== null ? tasks.length - toMigrate.length : 0;
    if (stillUnlinked === remaining) {
      console.log(`✓ All targeted tasks now have a project (${remaining} left only if --limit was used).`);
      console.log('\nSpot-check a few in the app, then deploy the new frontend.');
    } else {
      console.log(`✗ ${stillUnlinked} category task(s) still lack a project (expected ${remaining}). Investigate before deploying.`);
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
