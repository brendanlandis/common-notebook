'use strict';

/**
 * Convert the project `world` ENUM into rows of the new per-user `world`
 * collection (the worlds-in-code → worlds-as-data refactor). For every owner
 * that has world-tagged projects not yet pointing at a `world` row, the needed
 * world rows are created (once, per owner) and those projects are repointed onto
 * them via the new `worldRef` relation.
 *
 * The migrated world rows carry:
 *   - title    = the old enum value ("day job", "life stuff", …)
 *   - slug     = slugify(title)                (per-owner-unique via lifecycle)
 *   - systemKey= "stuff" for the stuff world, else null  (preserves stuff gating)
 *   - includeInCombinedViews = false for "day job", else true  (day-job parity)
 *   - position = index in CANONICAL_ORDER      (user can reorder later)
 *
 * IMPORTANT: this KEEPS the `world` enum value on each project. Adding the
 * relation is backward-compatible — the *old* frontend still reads `world`, the
 * *new* frontend reads `worldRef` (exposed as `project.world` by the BFF). The
 * enum is dropped only in Stage 4, after the new frontend is deployed & verified.
 *
 * PREREQUISITES (do these first, or this misbehaves):
 *   1. `project.worldRef` must be a **manyToOne** relation (many projects → one
 *      world). If it is oneToOne, Strapi STEALS the world from the previously
 *      linked project on each write and you end up with one project per world.
 *   2. Run AFTER the Stage 1 schema deploy (world collection + worldRef) is live.
 *   3. BACK UP FIRST.
 *
 * Usage:
 *   node scripts/migrate-worlds-to-collection.js --dry-run
 *   node scripts/migrate-worlds-to-collection.js                  # local (sqlite)
 *   node scripts/migrate-worlds-to-collection.js --yes            # non-sqlite (prod) — required
 *   node scripts/migrate-worlds-to-collection.js --yes --limit 1  # prove one project first
 */

const fs = require('fs');
const path = require('path');

const PROJECT_UID = 'api::project.project';
const WORLD_UID = 'api::world.world';
const PROJECT_TABLE = 'projects'; // collectionName of the project content type
const PAGE = 100; // Strapi clamps list pageSize to 100; page explicitly.

// The historical display order — becomes each world's initial `position`. Any
// project world value outside this list aborts the run (nothing silently skipped).
const CANONICAL_ORDER = ['make music', 'music admin', 'life stuff', 'day job', 'computer', 'stuff'];

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

/** The world-row shape a given enum value migrates into. */
function worldDefaults(worldName) {
  return {
    title: worldName,
    slug: slugify(worldName),
    systemKey: worldName === 'stuff' ? 'stuff' : null,
    includeInCombinedViews: worldName !== 'day job',
    position: CANONICAL_ORDER.indexOf(worldName),
  };
}

/** Load every project that has a `world` enum value but no `worldRef`, paged, with owner. */
async function loadWorldProjects(strapi) {
  const all = [];
  for (let start = 0; ; start += PAGE) {
    const rows = await strapi.documents(PROJECT_UID).findMany({
      filters: { world: { $notNull: true }, worldRef: { id: { $null: true } } },
      populate: ['owner', 'worldRef'],
      start,
      limit: PAGE,
    });
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/**
 * Restore updated_at on a project via a raw column write, bypassing the
 * lifecycle that stamps "now". Belt-and-suspenders parity with the category
 * migration — repointing shouldn't disturb the row's timestamp.
 */
async function restoreUpdatedAt(strapi, id, updatedAt) {
  await strapi.db
    .connection(PROJECT_TABLE)
    .where({ id })
    .update({ updated_at: updatedAt ? new Date(updatedAt) : null });
}

/**
 * Find or create the world row for (owner, worldName). Idempotent: matches an
 * existing row so a re-run reuses it instead of duplicating. The stuff world is
 * matched by its stable `systemKey` (so a renamed stuff world still counts);
 * every other world is matched by (owner, title).
 */
async function ensureWorld(strapi, ownerId, worldName, cache) {
  const key = `${ownerId}::${worldName}`;
  if (cache.has(key)) return cache.get(key);

  const spec = worldDefaults(worldName);
  const filters =
    worldName === 'stuff'
      ? { systemKey: { $eq: 'stuff' }, owner: { id: { $eq: ownerId } } }
      : { title: { $eq: worldName }, owner: { id: { $eq: ownerId } } };

  const existing = await strapi.documents(WORLD_UID).findMany({
    filters,
    populate: ['owner'],
    limit: 1,
  });

  let world = existing[0];
  if (!world) {
    world = await strapi.documents(WORLD_UID).create({
      data: { ...spec, owner: ownerId },
    });
  }
  cache.set(key, world);
  return world;
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

    const projects = await loadWorldProjects(app);
    console.log(`Found ${projects.length} world-tagged project(s) without a worldRef.`);

    // Refuse to migrate ownerless projects — the world would be ownerless/hidden.
    const orphans = projects.filter((p) => !(p.owner && p.owner.id));
    if (orphans.length > 0) {
      throw new Error(
        `${orphans.length} project(s) have no owner (e.g. ${orphans[0].documentId}). ` +
          `Run scripts/backfill-owner.js first.`
      );
    }

    // Refuse any world value outside the canonical set so nothing is silently skipped.
    const unknown = projects.filter((p) => !CANONICAL_ORDER.includes(p.world));
    if (unknown.length > 0) {
      const values = [...new Set(unknown.map((p) => p.world))];
      throw new Error(`Unknown world value(s): ${values.join(', ')}. Update CANONICAL_ORDER.`);
    }

    const byWorld = tallyBy(projects, (p) => p.world);
    for (const [world, n] of Object.entries(byWorld)) {
      console.log(`  ${world.padEnd(14)} ${n}`);
    }

    const toMigrate = LIMIT !== null ? projects.slice(0, LIMIT) : projects;
    if (LIMIT !== null) {
      console.log(`\n--limit ${LIMIT}: migrating only the first ${toMigrate.length} of ${projects.length}.`);
    }

    // Dump the source rows (documentId, owner, world, updatedAt) before writing.
    const dumpPath = path.resolve(process.cwd(), `migrate-worlds-to-collection.dump.${Date.now()}.json`);
    fs.writeFileSync(
      dumpPath,
      JSON.stringify(
        toMigrate.map((p) => ({
          documentId: p.documentId,
          owner: p.owner.id,
          world: p.world,
          updatedAt: p.updatedAt,
        })),
        null,
        2
      )
    );
    console.log(`\nSource dump written to ${dumpPath}`);

    if (DRY_RUN) {
      const sample = toMigrate[0];
      if (sample) {
        const spec = worldDefaults(sample.world);
        console.log('\nSample mapping (first project):');
        console.log(`  ${sample.documentId} "${sample.title}" world=${sample.world}`);
        console.log(
          `    -> world row "${spec.title}" systemKey=${spec.systemKey} ` +
            `includeInCombinedViews=${spec.includeInCombinedViews} position=${spec.position}`
        );
      }
      console.log(`\nWould repoint ${toMigrate.length} project(s) onto ${Object.keys(byWorld).length} world(s) per owner.`);
      console.log('Re-run without --dry-run to write.');
      return;
    }

    console.log(`\nRepointing ${toMigrate.length} project(s)...`);
    const worldCache = new Map();
    const mapping = [];
    let done = 0;
    for (const project of toMigrate) {
      const world = await ensureWorld(app, project.owner.id, project.world, worldCache);
      // Repoint the project onto the world row (keeping its `world` enum value).
      await app.documents(PROJECT_UID).update({
        documentId: project.documentId,
        data: { worldRef: world.id },
      });
      await restoreUpdatedAt(app, project.id, project.updatedAt);
      mapping.push({ project: project.documentId, world: project.world, worldRef: world.documentId });
      done += 1;
      if (process.stdout.isTTY) process.stdout.write(`  ${done}/${toMigrate.length}\r`);
    }
    if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(40)}\r`);

    const mappingPath = path.resolve(process.cwd(), `migrate-worlds-to-collection.mapping.${Date.now()}.json`);
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`\nRepointed ${done} project(s). Mapping written to ${mappingPath}`);

    // Verify: every migrated project now has a worldRef.
    const stillUnlinked = await app.db.query(PROJECT_UID).count({
      where: { world: { $notNull: true }, worldRef: { id: { $null: true } } },
    });
    const remaining = LIMIT !== null ? projects.length - toMigrate.length : 0;
    if (stillUnlinked === remaining) {
      console.log(`✓ All targeted projects now have a worldRef (${remaining} left only if --limit was used).`);
      console.log('\nSpot-check a few in the app, then deploy the new frontend.');
    } else {
      console.log(`✗ ${stillUnlinked} world project(s) still lack a worldRef (expected ${remaining}). Investigate before deploying.`);
      process.exitCode = 1;
    }
  } finally {
    // Strapi emits lifecycle/webhook events for our writes asynchronously. Give
    // any still-pending ones a moment to flush *while Strapi is alive*, so they
    // don't fire after destroy() has torn down the global `strapi` binding (see
    // the unhandledRejection guard below).
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await app.destroy();
  }
}

// A lifecycle event that fires after app.destroy() tries to sanitize its payload
// using the now-deleted global `strapi`, throwing `strapi is not defined`. All DB
// writes are awaited and committed before we get here, so this specific
// post-teardown error is cosmetic — swallow only it, and let anything else crash.
process.on('unhandledRejection', (err) => {
  if (err instanceof ReferenceError && /strapi is not defined/.test(String(err && err.message))) {
    return;
  }
  console.error(err);
  process.exit(1);
});

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
