'use strict';

/**
 * List every relation that links rows belonging to different owners.
 *
 * Usage:
 *   node scripts/audit-cross-owner-links.js           # a report; exit 1 if any
 *   node scripts/audit-cross-owner-links.js --json    # the findings as JSON
 *
 * The ownership middleware now refuses a write that links to someone else's row
 * (src/ownership/relations.ts), and populate is only safe because of that: it
 * reads relation targets with no owner filter. So a link made before the check
 * existed would still hand one user another user's row. Run this once on
 * production after deploying the check; it should find nothing. It also lists
 * links where either end has no owner, which the middleware makes invisible.
 *
 * Read-only: it only runs queries. Booting Strapi does run the usual bootstrap
 * seeders, exactly as `strapi start` does. On SQLite, stop the running backend
 * first — SQLite allows one writer.
 *
 * Exit codes: 0 clean, 1 findings, 2 error.
 */

const path = require('path');

const PAGE = 500;
const JSON_OUTPUT = process.argv.includes('--json');

const OWNER = { select: ['id', 'username'] };

/**
 * The links to check: each relation between owned types, from its owning side
 * only (the `mappedBy` side is the same link row), including relations inside a
 * component. `via` is the component attribute holding the relation, if any.
 */
function ownedLinks(app, owned) {
  const links = [];
  for (const uid of owned) {
    for (const [name, attribute] of Object.entries(app.getModel(uid).attributes)) {
      if (attribute.type === 'relation' && owned.has(attribute.target) && !attribute.mappedBy) {
        links.push({ uid, via: null, field: name, target: attribute.target });
      }
      if (attribute.type === 'component') {
        const component = app.getModel(attribute.component);
        for (const [inner, innerAttribute] of Object.entries(component.attributes)) {
          if (innerAttribute.type === 'relation' && owned.has(innerAttribute.target)) {
            links.push({ uid, via: name, field: inner, target: innerAttribute.target });
          }
        }
      }
    }
  }
  return links;
}

const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const who = (owner) => (owner ? `${owner.username} (${owner.id})` : 'no owner');

async function auditLink(app, link) {
  const targets = { select: ['id', 'documentId'], populate: { owner: OWNER } };
  const populate = link.via
    ? { owner: OWNER, [link.via]: { populate: { [link.field]: targets } } }
    : { owner: OWNER, [link.field]: targets };

  const findings = [];
  let checked = 0;
  for (let offset = 0; ; offset += PAGE) {
    const rows = await app.db.query(link.uid).findMany({
      select: ['id', 'documentId'],
      populate,
      orderBy: { id: 'asc' },
      offset,
      limit: PAGE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const linked = link.via
        ? list(row[link.via]).flatMap((component) => list(component[link.field]))
        : list(row[link.field]);
      for (const target of linked) {
        checked += 1;
        const from = row.owner?.id;
        const to = target.owner?.id;
        if (from === undefined || to === undefined || from !== to) {
          findings.push({
            relation: `${link.uid}.${link.via ? `${link.via}.` : ''}${link.field}`,
            from: { documentId: row.documentId, id: row.id, owner: who(row.owner) },
            to: { uid: link.target, documentId: target.documentId, id: target.id, owner: who(target.owner) },
          });
        }
      }
    }
  }
  return { checked, findings };
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    // The list the middleware enforces, from the compiled app, so this can't
    // drift from it the way a copy would.
    const { OWNED_CONTENT_TYPES } = require(path.join(appContext.distDir, 'src/ownership/rule.js'));
    const owned = new Set(OWNED_CONTENT_TYPES);

    const all = [];
    const client = app.config.get('database.connection.client');
    if (!JSON_OUTPUT) console.log(`\nDatabase: ${client}\n`);

    for (const link of ownedLinks(app, owned)) {
      const { checked, findings } = await auditLink(app, link);
      all.push(...findings);
      if (!JSON_OUTPUT) {
        const name = `${link.uid}.${link.via ? `${link.via}.` : ''}${link.field}`;
        console.log(`  ${name.padEnd(72)} ${String(checked).padStart(6)} links, ${findings.length} crossing`);
      }
    }

    if (JSON_OUTPUT) {
      console.log(JSON.stringify(all, null, 2));
    } else if (all.length === 0) {
      console.log('\n✓ No link crosses owners.');
    } else {
      console.log(`\n✗ ${all.length} links cross owners or lack one:\n`);
      for (const f of all) {
        console.log(`  ${f.relation}: ${f.from.documentId} [${f.from.owner}] → ${f.to.documentId} [${f.to.owner}]`);
      }
      console.log('\nUnlink them in the admin panel, then run this again.');
    }
    process.exitCode = all.length === 0 ? 0 : 1;
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
