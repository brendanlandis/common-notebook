// Priority marker parsing for project titles.
//
// A project can carry a priority marker in its title as a whole-word token
// `p1`, `p2`, `p3`, … ("p" = priority). This is used by world-style task views
// to order projects between the "top of mind" and "normal" tiers.

/**
 * Returns the priority number encoded in a project title, or null if none.
 *
 * Matching is whole-word and case-insensitive: "p1" / "P1" match as standalone
 * tokens, but substrings like "revamp1" do not. If a title contains multiple
 * markers, the lowest number (highest priority) wins.
 */
export function getProjectPriority(title: string | undefined | null): number | null {
  if (!title) return null;
  const matches = [...title.matchAll(/\bp(\d+)\b/gi)].map((m) => parseInt(m[1], 10));
  return matches.length ? Math.min(...matches) : null;
}
