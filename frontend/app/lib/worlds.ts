import type { World, WorldMode } from "@/app/types/index";

// Worlds are user-populated data now (the `api::world.world` collection), not a
// hardcoded list. These pure helpers resolve a view section's world selection
// against the user's worlds; the list itself comes from WorldsContext / the
// /api/worlds BFF.

/** The stable handle of the special "stuff" world (wishlist/errands/…). */
export const STUFF_SYSTEM_KEY = "stuff";

/**
 * The stable handle of the practice-and-study world.
 *
 * The *title* is the user's ("practice and study" today) and can be renamed; the
 * systemKey is what the code matches on. Being a system world is what keeps
 * material out of everyday views — see `resolveVisibleWorldIds` below — which is
 * the whole reason practice can share the task substrate without competing with
 * chores for the same attention.
 */
export const PRACTICE_SYSTEM_KEY = "practice";

export function isStuffWorld(w: World): boolean {
  return w.systemKey === STUFF_SYSTEM_KEY;
}

export function isPracticeWorld(w: World | null | undefined): boolean {
  return w?.systemKey === PRACTICE_SYSTEM_KEY;
}

/** True for any system world (a stable `systemKey`, e.g. stuff). */
function isSystemWorld(w: World): boolean {
  return w.systemKey != null && w.systemKey !== "";
}

/**
 * The set of world documentIds a section spans, resolved from its `worldMode`
 * (`all`/`only`/`except`) + explicitly-named `worldIds` against the user's
 * worlds.
 *
 * System worlds (a `systemKey`, i.e. stuff) surface ONLY when named explicitly
 * under `only`; `all` and `except` never include them. This preserves the old
 * behavior where stuff appeared only in its own view.
 */
export function resolveVisibleWorldIds(
  worldMode: WorldMode,
  worldIds: string[],
  worlds: World[]
): Set<string> {
  const named = new Set(worldIds);
  const pick = (w: World): boolean => {
    if (worldMode === "only") return named.has(w.documentId);
    // `all` and `except` never surface system (stuff) worlds.
    if (isSystemWorld(w)) return false;
    if (worldMode === "all") return true;
    return !named.has(w.documentId); // except
  };
  return new Set(worlds.filter(pick).map((w) => w.documentId));
}

/** The worlds a section spans, in the user's `position` order. */
export function resolveVisibleWorlds(
  worldMode: WorldMode,
  worldIds: string[],
  worlds: World[]
): World[] {
  const ids = resolveVisibleWorldIds(worldMode, worldIds, worlds);
  return worlds.filter((w) => ids.has(w.documentId));
}

export function findWorldBySlug(slug: string, worlds: World[]): World | undefined {
  return worlds.find((w) => w.slug === slug);
}

export function findWorldById(documentId: string, worlds: World[]): World | undefined {
  return worlds.find((w) => w.documentId === documentId);
}

export function findStuffWorld(worlds: World[]): World | undefined {
  return worlds.find(isStuffWorld);
}

/** Ascending by `position`; input order is the stable tiebreaker. */
export function sortWorldsByPosition(worlds: World[]): World[] {
  return worlds
    .map((w, i) => [w, i] as const)
    .sort((a, b) => (a[0].position ?? 0) - (b[0].position ?? 0) || a[1] - b[1])
    .map(([w]) => w);
}
