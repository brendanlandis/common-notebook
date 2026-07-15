import type { World, WorldScope } from "@/app/types/index";

// Worlds are user-populated data now (the `api::world.world` collection), not a
// hardcoded list. These pure helpers resolve a view's WorldScope against the
// user's worlds; the list itself comes from WorldsContext / the /api/worlds BFF.

/** The stable handle of the special "stuff" world (wishlist/errands/…). */
export const STUFF_SYSTEM_KEY = "stuff";

function isStuffWorld(w: World): boolean {
  return w.systemKey === STUFF_SYSTEM_KEY;
}

/**
 * The set of world documentIds a view spans, resolved against the user's worlds.
 *
 * The stuff world is surfaced ONLY by a scope that names it explicitly
 * (`{ systemKey: 'stuff' }`, or `{ worldId }` pointing at it) — never by the
 * aggregate scopes ('all' / 'combined' / 'excluded'). This preserves the old
 * behaviour where stuff appeared only in its own view.
 */
export function resolveVisibleWorldIds(scope: WorldScope, worlds: World[]): Set<string> {
  const namesStuffExplicitly =
    typeof scope === "object" &&
    (("systemKey" in scope && scope.systemKey === STUFF_SYSTEM_KEY) ||
      ("worldId" in scope && worlds.some((w) => w.documentId === scope.worldId && isStuffWorld(w))));

  const pick = (w: World): boolean => {
    if (isStuffWorld(w) && !namesStuffExplicitly) return false;
    if (scope === "all") return true;
    if (scope === "combined") return w.includeInCombinedViews;
    if (scope === "excluded") return !w.includeInCombinedViews;
    if ("systemKey" in scope) return w.systemKey === scope.systemKey;
    return w.documentId === scope.worldId; // { worldId }
  };

  return new Set(worlds.filter(pick).map((w) => w.documentId));
}

/** The worlds a view spans, in the user's `position` order. */
export function resolveVisibleWorlds(scope: WorldScope, worlds: World[]): World[] {
  const ids = resolveVisibleWorldIds(scope, worlds);
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
