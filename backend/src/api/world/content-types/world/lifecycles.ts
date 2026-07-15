/**
 * World slug lifecycle.
 *
 * `slug` is a plain `string` (not Strapi's `uid`, which is globally unique —
 * wrong for a multi-tenant app, where two users may want the same slug). This
 * hook is the single place that both (a) guarantees every world gets a slug and
 * (b) enforces uniqueness PER OWNER, auto-suffixing on collision (`foo`, `foo-2`,
 * `foo-3`, …). Mirrors the project slug lifecycle.
 *
 * It runs for every write path — the frontend BFF, the Strapi admin UI, and the
 * direct content API — because a content-type lifecycle fires beneath all of
 * them (the ownership document-service middleware stamps `data.owner` first, so
 * the owner is already present on create).
 *
 * Caveat: two *simultaneous* same-title creates by one owner could race to the
 * same suffix — there's no DB unique constraint backing this. Acceptable at this
 * app's single-process scale, matching the other in-process guards in the repo.
 */

// Keep in sync with frontend/app/lib/slugify.ts.
function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The owner arrives as a scalar id (content-API create, stamped by the
// ownership middleware), a loaded relation ({ id }), or a relation-write shape
// ({ connect: [...] } / { set: [...] }) from the admin UI. Normalize them all.
function extractOwnerId(owner: any): number | null {
  if (owner == null) return null;
  if (typeof owner === "number") return owner;
  if (typeof owner === "string") return Number(owner) || null;
  if (Array.isArray(owner)) return extractOwnerId(owner[0]);
  if (typeof owner === "object") {
    if (owner.id != null) return extractOwnerId(owner.id);
    if (owner.connect) return extractOwnerId(owner.connect);
    if (owner.set) return extractOwnerId(owner.set);
  }
  return null;
}

async function uniqueSlugForOwner(
  base: string,
  ownerId: number | null,
  selfId: number | null
): Promise<string> {
  const safeBase = base || "world";

  // No owner in scope (e.g. a direct-DB seed/backfill script that bypasses the
  // ownership middleware) — best effort, unscoped, no suffixing.
  if (ownerId == null) return safeBase;

  const existing = await strapi.db
    .query("api::world.world")
    .findMany({ where: { owner: { id: ownerId } }, populate: [] });

  const taken = new Set<string>(
    existing
      .filter((w: any) => w.id !== selfId)
      .map((w: any) => w.slug)
      .filter(Boolean)
  );

  let candidate = safeBase;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${safeBase}-${n++}`;
  }
  return candidate;
}

export default {
  async beforeCreate(event: { params: { data?: any } }) {
    const data = event.params.data;
    if (!data) return;
    const base = slugify(data.slug || data.title || "");
    const ownerId = extractOwnerId(data.owner);
    data.slug = await uniqueSlugForOwner(base, ownerId, null);
  },

  async beforeUpdate(event: { params: { data?: any; where?: any } }) {
    const data = event.params.data;
    if (!data) return;
    // Only recompute when the slug or title is actually changing.
    if (data.slug == null && data.title == null) return;

    // Update payloads don't carry the owner, so load the current row for its
    // owner and id (id is needed to exclude self from the uniqueness check).
    let current: any = null;
    if (event.params.where) {
      current = await strapi.db
        .query("api::world.world")
        .findOne({ where: event.params.where, populate: ["owner"] });
    }

    const base = slugify(data.slug || data.title || current?.title || "");
    const ownerId = extractOwnerId(current?.owner) ?? extractOwnerId(data.owner);
    data.slug = await uniqueSlugForOwner(base, ownerId, current?.id ?? null);
  },
};
