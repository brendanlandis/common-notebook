import type { World } from "@/app/types/index";

// Single source of truth for the set of worlds (mirrors the World union in
// types/index.ts). Used for route validation and world navigation.
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
