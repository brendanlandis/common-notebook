import type { World } from "@/app/types/index";

// Single source of truth for the set of *navigable* worlds — those rendered via
// the world-grouped mechanism (WorldSections / the /todo/world/[world] route).
// Note: the World union also includes `stuff`, which is deliberately absent here:
// stuff projects are surfaced by the `stuff` preset via StuffLayout, not as a
// generic world route/section.
export const WORLDS: World[] = [
  "life stuff",
  "music admin",
  "make music",
  "day job",
  "computer",
];

export function isValidWorld(value: string): value is World {
  return (WORLDS as string[]).includes(value);
}
