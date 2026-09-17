'use strict';

/**
 * Fill the local database with a month of practice sessions, so the practice
 * page and its chart have something to show on a laptop.
 *
 * Usage:
 *   node scripts/sample-practice.js               Create the sample data
 *   node scripts/sample-practice.js --reset       Delete it again
 *   node scripts/sample-practice.js --user <name> Whose data it is (default: DEV_AUTH_USER)
 *
 * Everything it writes is titled with SAMPLE_TAG, and --reset deletes exactly
 * those rows plus their sessions. Practice logs carry no title of their own, so
 * they are found through their material instead.
 *
 * Local SQLite only, for the same reason seed-dev.js is: it writes rows that
 * would be someone's real practice history in production.
 */

const path = require('path');

// backend/.env holds live production SMTP credentials and sets EMAIL_ENABLED=true.
// dotenv never overwrites an already-set variable, so this wins and
// config/plugins.ts installs the sink instead — the same guard the e2e config
// applies. A script that invents practice history has no business holding a mail
// transport at all.
process.env.EMAIL_ENABLED = 'false';

// Before the guard below, which reads DATABASE_CLIENT — see seed-dev.js.
require('dotenv').config({
  path: process.env.ENV_PATH || path.resolve(__dirname, '..', '.env'),
});

const SAMPLE_TAG = '[sample]';

const RESET = process.argv.includes('--reset');
const userArg = process.argv.indexOf('--user');
const USERNAME =
  userArg > -1 ? process.argv[userArg + 1] : process.env.DEV_AUTH_USER || 'brendan';

/** What gets practiced: one project per subject, each with its own pieces. */
const SUBJECTS = [
  { project: 'guitar', material: ['scales', 'bird catcher solo', 'sight reading'] },
  { project: 'piano', material: ['hanon no. 1', 'satie gymnopédie'] },
  { project: 'ear training', material: ['intervals', 'chord quality'] },
];

/**
 * A month of practice, in minutes per subject per day, oldest day first.
 *
 * Handwritten rather than random: the chart is the thing being looked at, and it
 * should show a habit — guitar most days, piano a few times a week, ear training
 * in short bursts — rather than noise. 0 means "didn't practice that".
 */
const DAYS = [
  [45, 0, 0], [30, 20, 10], [0, 0, 0], [60, 0, 15], [25, 30, 0],
  [40, 0, 0], [0, 45, 10], [50, 0, 0], [35, 25, 20], [0, 0, 0],
  [55, 0, 10], [30, 40, 0], [45, 0, 0], [0, 20, 15], [40, 0, 0],
  [60, 35, 0], [20, 0, 10], [0, 0, 0], [45, 25, 0], [35, 0, 20],
  [50, 0, 0], [0, 40, 10], [30, 0, 0], [45, 30, 15], [0, 0, 0],
  [55, 0, 0], [25, 20, 10], [40, 0, 0], [0, 35, 20], [50, 15, 0],
];

function refuseUnlessLocalSqlite() {
  const client = process.env.DATABASE_CLIENT || 'sqlite';
  const env = process.env.NODE_ENV || 'development';
  if (client !== 'sqlite' || env === 'production') {
    console.error(
      `\nRefusing to write sample data: DATABASE_CLIENT=${client}, NODE_ENV=${env}.\n` +
        `This script invents practice history and is for local SQLite only.\n`
    );
    process.exit(1);
  }
}

/** `YYYY-MM-DD`, `offset` days before today. */
function isoDaysAgo(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

async function deleteSample(strapi, ownerId) {
  const owner = { owner: { id: { $eq: ownerId } } };
  let logs = 0;
  let tasks = 0;
  let projects = 0;

  // Sessions first: deleting the material would otherwise leave them orphaned
  // and unfindable, since a practice log has no title to tag.
  const material = await strapi.documents('api::task.task').findMany({
    filters: { ...owner, title: { $startsWith: SAMPLE_TAG } },
    limit: 500,
  });
  for (const task of material) {
    const sessions = await strapi.documents('api::practice-log.practice-log').findMany({
      filters: { ...owner, material: { documentId: { $eq: task.documentId } } },
      limit: 500,
    });
    for (const s of sessions) {
      await strapi.documents('api::practice-log.practice-log').delete({
        documentId: s.documentId,
      });
      logs += 1;
    }
    await strapi.documents('api::task.task').delete({ documentId: task.documentId });
    tasks += 1;
  }

  const sampleProjects = await strapi.documents('api::project.project').findMany({
    filters: { ...owner, title: { $startsWith: SAMPLE_TAG } },
    limit: 500,
  });
  for (const p of sampleProjects) {
    await strapi.documents('api::project.project').delete({ documentId: p.documentId });
    projects += 1;
  }

  return { logs, tasks, projects };
}

async function main() {
  refuseUnlessLocalSqlite();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';

  try {
    const user = await app
      .query('plugin::users-permissions.user')
      .findOne({ where: { username: USERNAME } });
    if (!user) throw new Error(`No user named "${USERNAME}".`);
    const owner = user.id;

    const removed = await deleteSample(app, owner);
    console.log(
      `Removed ${removed.logs} sample sessions, ${removed.tasks} material, ${removed.projects} projects.`
    );
    if (RESET) return;

    // The practice world is addressed by its systemKey, not its title, which the
    // user is free to rename.
    const [world] = await app.documents('api::world.world').findMany({
      filters: { owner: { id: { $eq: owner } }, systemKey: { $eq: 'practice' } },
      limit: 1,
    });
    if (!world) throw new Error(`No practice world for "${USERNAME}".`);

    const materialIds = [];
    for (const subject of SUBJECTS) {
      const project = await app.documents('api::project.project').create({
        data: {
          title: `${SAMPLE_TAG} ${subject.project}`,
          // The relation is `worldRef`; `world` is what the app's own API calls
          // it, and passing that name silently set nothing, leaving projects in
          // no world at all.
          worldRef: { connect: [world.documentId] },
          importance: 'normal',
          projectType: 'instrument',
          owner,
        },
      });
      const ids = [];
      for (const title of subject.material) {
        const task = await app.documents('api::task.task').create({
          data: {
            title: `${SAMPLE_TAG} ${title}`,
            completed: false,
            recurrenceType: 'none',
            project: project.documentId,
            owner,
          },
        });
        ids.push(task.documentId);
      }
      materialIds.push(ids);
    }

    let created = 0;
    for (const [index, minutesPerSubject] of DAYS.entries()) {
      const date = isoDaysAgo(DAYS.length - 1 - index);
      // Sessions sit in the evening, an hour apart, so a day's sessions read in
      // the order they were practiced.
      let hour = 18;
      for (const [subject, minutes] of minutesPerSubject.entries()) {
        if (minutes === 0) continue;
        const ids = materialIds[subject];
        const material = ids[index % ids.length];
        const start = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
        const stop = new Date(start.getTime() + minutes * 60_000);
        await app.documents('api::practice-log.practice-log').create({
          data: {
            date,
            start: start.toISOString(),
            stop: stop.toISOString(),
            duration: minutes,
            // One unbroken stretch: the app reads elapsed time from the
            // segments, and `duration` alone would leave a session's clock at 0.
            segments: [{ start: start.toISOString(), stop: stop.toISOString() }],
            material,
            owner,
          },
        });
        created += 1;
        hour += 1;
      }
    }

    console.log(
      `Created ${created} sample sessions across ${DAYS.length} days, ` +
        `${SUBJECTS.length} subjects. Remove them with --reset.`
    );
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
