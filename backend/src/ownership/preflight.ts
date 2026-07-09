/**
 * Boot-time check: warn loudly if any row lacks an owner.
 *
 * The ownership middleware fails closed. A row with no owner is invisible to
 * every user of the content API — including you. That is the expected state
 * *before* `scripts/backfill-owner.js` has run, and a catastrophic-looking one
 * after. This turns a silent, confusing outage into a line in the logs.
 *
 * Deliberately a warning rather than a thrown error: refusing to boot would turn
 * a recoverable "my todos vanished" into a hard production outage, and the data
 * itself is never at risk.
 */

const UNOWNED_FILTER = { owner: { id: { $null: true } } };

export async function warnOnUnownedRows(strapi: any, contentTypes: readonly string[]) {
  const unowned: Array<[string, number]> = [];

  for (const uid of contentTypes) {
    try {
      const count = await strapi.documents(uid).count({ filters: UNOWNED_FILTER });
      if (count > 0) unowned.push([uid, count]);
    } catch (err) {
      // A missing `owner` field means the schema hasn't been deployed yet.
      strapi.log.warn(`[ownership] could not check ${uid} for unowned rows: ${err.message}`);
    }
  }

  if (unowned.length === 0) return;

  const total = unowned.reduce((sum, [, n]) => sum + n, 0);
  strapi.log.error(
    `[ownership] ${total} row(s) have no owner and are therefore invisible to every user:\n` +
      unowned.map(([uid, n]) => `           ${uid}: ${n}`).join('\n') +
      `\n           Run: node scripts/backfill-owner.js --user <id>`
  );
}
