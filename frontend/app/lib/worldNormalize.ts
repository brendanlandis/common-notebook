import type { Project } from "@/app/types/index";

// The project ↔ world relation is stored in Strapi as `worldRef` (a manyToOne),
// alongside the legacy `world` enum that is being retired. The rest of the app
// speaks only `project.world` (a World object, or null). These two helpers are
// the single translation layer, applied in the projects BFF.

/**
 * Read side: turn a raw Strapi project (with `worldRef` populated and the legacy
 * `world` enum) into the app's shape, where `world` is the World object or null.
 */
export function normalizeProjectWorld(raw: any): Project {
  if (!raw) return raw;
  const { worldRef, world: _legacyEnum, ...rest } = raw;
  return { ...rest, world: worldRef ?? null } as Project;
}

/**
 * Write side: the client sends `world` = a world documentId (or "" / null for
 * "no world"). Map it onto the Strapi relation field and never write the enum.
 *
 * Only touch `worldRef` when the caller actually supplied a world. A partial PUT
 * that omits `world` (importance-only, complete, revive) must leave the relation
 * alone — emitting `worldRef: null` there told Strapi to CLEAR the relation, which
 * silently wiped a project's world on every such write. Absent → omit the key;
 * present as "" / null → explicit "no world" (honored).
 */
export function toStrapiProjectWrite(body: any): any {
  const { world, worldRef, ...rest } = body ?? {};
  if (world === undefined && worldRef === undefined) return rest;
  const chosen = world ?? worldRef ?? null;
  const worldId = chosen === "" ? null : chosen;
  return { ...rest, worldRef: worldId };
}
