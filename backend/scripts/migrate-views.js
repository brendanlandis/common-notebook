'use strict';

/**
 * Seed each existing user's per-user `view` collection with the seven composable
 * default views (the views-in-code → views-as-data refactor). Mirrors
 * migrate-worlds-to-collection.js.
 *
 * Each view is created with its `layout` and ordered `sections` (filter sets).
 * A section's world selection is computed from THIS user's current worlds:
 *   - worldRule "all"      -> worldMode "all",  worlds []              (every non-stuff world + incidentals)
 *   - worldRule "combined" -> worldMode "except", worlds [day-job-like] (worlds with includeInCombinedViews === false)
 *   - worldRule "stuff"    -> worldMode "only",  worlds [the stuff world]
 * This reads `world.includeInCombinedViews` BEFORE Stage 4 drops it.
 *
 * `done`/`recurring` are code presets (no rows). `invoicing` is retired.
 *
 * Idempotent: a seed view is created only if the user has no view with that slug
 * (or, for stuff, that systemKey). Re-runnable. Existing users already have
 * worlds, so this seeds VIEWS only.
 *
 * PREREQUISITES:
 *   1. Run AFTER the Stage 1 schema deploy (view collection + view.section
 *      component with a manyWay `worlds` relation) is live.
 *   2. BACK UP FIRST.
 *
 * Usage:
 *   node scripts/migrate-views.js --dry-run
 *   node scripts/migrate-views.js                 # local (sqlite)
 *   node scripts/migrate-views.js --yes           # non-sqlite (prod) — required
 *   node scripts/migrate-views.js --yes --limit 1 # seed one user first
 */

const fs = require('fs');
const path = require('path');

const USER_UID = 'plugin::users-permissions.user';
const WORLD_UID = 'api::world.world';
const VIEW_UID = 'api::view.view';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const YES = args.includes('--yes');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) : null;

// The seven composable defaults, in display order. `worldRule` is resolved per
// user; `requiresStuffWorld` seeds the stuff view only for users who have one.
const SEED_VIEWS = [
  {
    slug: 'good-morning', name: 'good morning', systemKey: null, layout: 'projects', position: 0,
    sections: [
      { name: 'top of mind', worldRule: 'all', importance: 'soonAndTopOfMind', projectType: 'any', recurrence: 'nonRecurring', longOnly: false },
      { name: 'recurring', worldRule: 'combined', importance: 'any', projectType: 'any', recurrence: 'recurring', longOnly: false },
    ],
  },
  {
    slug: 'chores', name: 'chores', systemKey: null, layout: 'projects', position: 1,
    sections: [{ name: null, worldRule: 'combined', importance: 'any', projectType: 'chores', recurrence: 'nonRecurring', longOnly: false }],
  },
  {
    slug: 'everything', name: 'everything', systemKey: null, layout: 'chronological', position: 2,
    sections: [{ name: null, worldRule: 'combined', importance: 'any', projectType: 'any', recurrence: 'both', longOnly: false }],
  },
  {
    slug: 'chipping-away', name: 'chipping away', systemKey: null, layout: 'chronological', position: 3,
    sections: [{ name: null, worldRule: 'combined', importance: 'any', projectType: 'any', recurrence: 'both', longOnly: true }],
  },
  {
    slug: 'roulette', name: 'roulette', systemKey: null, layout: 'roulette', position: 4,
    sections: [{ name: null, worldRule: 'combined', importance: 'any', projectType: 'any', recurrence: 'both', longOnly: false }],
  },
  {
    slug: 'stuff', name: 'stuff', systemKey: 'stuff', layout: 'projects', position: 5, requiresStuffWorld: true,
    sections: [{ name: null, worldRule: 'stuff', importance: 'any', projectType: 'any', recurrence: 'nonRecurring', longOnly: false }],
  },
  {
    slug: 'later', name: 'later', systemKey: null, layout: 'projects', position: 6,
    sections: [{ name: null, worldRule: 'all', importance: 'later', projectType: 'any', recurrence: 'both', longOnly: false }],
  },
];

// Resolve a section's world selection from the user's worlds. Returns the
// section write shape (worlds as documentIds — verified round-trip).
function resolveSection(section, userWorlds) {
  let worldMode = 'all';
  let worlds = [];
  if (section.worldRule === 'combined') {
    worldMode = 'except';
    worlds = userWorlds.filter((w) => w.includeInCombinedViews === false).map((w) => w.documentId);
  } else if (section.worldRule === 'stuff') {
    worldMode = 'only';
    worlds = userWorlds.filter((w) => w.systemKey === 'stuff').map((w) => w.documentId);
  }
  const out = {
    worldMode,
    worlds,
    importance: section.importance,
    projectType: section.projectType,
    recurrence: section.recurrence,
    longOnly: section.longOnly,
  };
  if (section.name) out.name = section.name;
  return out;
}

async function loadUsers(strapi) {
  return strapi.db.query(USER_UID).findMany({ select: ['id', 'username', 'email'] });
}

async function loadUserWorlds(strapi, userId) {
  const worlds = [];
  for (let start = 0; ; start += 100) {
    const rows = await strapi.documents(WORLD_UID).findMany({
      filters: { owner: { id: { $eq: userId } } },
      start,
      limit: 100,
    });
    worlds.push(...rows);
    if (rows.length < 100) break;
  }
  return worlds;
}

async function existingSlugs(strapi, userId) {
  const rows = await strapi.documents(VIEW_UID).findMany({
    filters: { owner: { id: { $eq: userId } } },
    limit: 100,
  });
  return new Set(rows.map((v) => v.slug));
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    const client = app.config.get('database.connection.client');
    console.log(`\nDatabase: ${client}`);
    console.log(DRY_RUN ? 'Mode: DRY RUN — nothing will be written\n' : 'Mode: WRITING\n');

    if (LIMIT !== null && (!Number.isInteger(LIMIT) || LIMIT <= 0)) {
      throw new Error(`--limit needs a positive integer, got "${args[limitIdx + 1]}".`);
    }
    if (!DRY_RUN && client !== 'sqlite' && !YES) {
      throw new Error(
        `Refusing to write to a "${client}" database without --yes. ` +
          `This looks like production. Back up first, then re-run with --yes.`
      );
    }

    let users = await loadUsers(app);
    console.log(`Found ${users.length} user(s).`);
    if (LIMIT !== null) {
      users = users.slice(0, LIMIT);
      console.log(`--limit ${LIMIT}: seeding only the first ${users.length}.`);
    }

    const plan = [];
    for (const user of users) {
      const userWorlds = await loadUserWorlds(app, user.id);
      const has = DRY_RUN ? new Set() : await existingSlugs(app, user.id);
      const hasStuffWorld = userWorlds.some((w) => w.systemKey === 'stuff');

      for (const seed of SEED_VIEWS) {
        if (seed.requiresStuffWorld && !hasStuffWorld) continue;
        if (has.has(seed.slug)) continue;
        const sections = seed.sections.map((s) => resolveSection(s, userWorlds));
        plan.push({ userId: user.id, username: user.username, seed, sections });
      }
    }

    const dumpPath = path.resolve(process.cwd(), `migrate-views.dump.${Date.now()}.json`);
    fs.writeFileSync(
      dumpPath,
      JSON.stringify(
        plan.map((p) => ({
          userId: p.userId,
          slug: p.seed.slug,
          layout: p.seed.layout,
          sections: p.sections.map((s) => ({ worldMode: s.worldMode, worlds: s.worlds, importance: s.importance, projectType: s.projectType, recurrence: s.recurrence, longOnly: s.longOnly })),
        })),
        null,
        2
      )
    );
    console.log(`\nWould create ${plan.length} view(s) across ${users.length} user(s). Dump: ${dumpPath}`);

    if (DRY_RUN) {
      const sample = plan[0];
      if (sample) {
        console.log('\nSample (first view):');
        console.log(`  user ${sample.userId} -> "${sample.seed.slug}" (${sample.seed.layout})`);
        sample.sections.forEach((s, i) => console.log(`    section ${i}: worldMode=${s.worldMode} worlds=[${s.worlds.join(',')}] importance=${s.importance} recurrence=${s.recurrence}`));
      }
      console.log('\nRe-run without --dry-run to write.');
      return;
    }

    let created = 0;
    for (const item of plan) {
      const data = {
        name: item.seed.name,
        slug: item.seed.slug,
        position: item.seed.position,
        layout: item.seed.layout,
        sections: item.sections,
        owner: item.userId,
      };
      if (item.seed.systemKey) data.systemKey = item.seed.systemKey;
      await app.documents(VIEW_UID).create({ data });
      created += 1;
      if (process.stdout.isTTY) process.stdout.write(`  ${created}/${plan.length}\r`);
    }
    if (process.stdout.isTTY) process.stdout.write(`\r${' '.repeat(40)}\r`);
    console.log(`\nCreated ${created} view(s).`);

    // Verify: every seeded user now has ≥1 view.
    let missing = 0;
    for (const user of users) {
      const count = await app.db.query(VIEW_UID).count({ where: { owner: { id: { $eq: user.id } } } });
      if (count === 0) {
        console.log(`✗ user ${user.id} (${user.username}) still has no views.`);
        missing += 1;
      }
    }
    if (missing === 0) {
      console.log('✓ Every seeded user has views. Spot-check the To Do dropdown, then deploy.');
    } else {
      console.log(`✗ ${missing} user(s) have no views. Investigate before deploying.`);
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await app.destroy();
  }
}

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
