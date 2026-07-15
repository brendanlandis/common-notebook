import { describe, it, expect } from "vitest";
import {
  resolveVisibleWorldIds,
  resolveVisibleWorlds,
  findWorldBySlug,
  findStuffWorld,
  sortWorldsByPosition,
} from "./worlds";
import type { World } from "@/app/types/index";

function w(overrides: Partial<World> & { documentId: string }): World {
  return {
    id: 1,
    title: overrides.documentId,
    slug: overrides.documentId,
    position: 0,
    systemKey: null,
    includeInCombinedViews: true,
    ...overrides,
  };
}

const lifeStuff = w({ documentId: "life", title: "life stuff", slug: "life-stuff", position: 2 });
const dayJob = w({ documentId: "day", title: "day job", slug: "day-job", position: 3, includeInCombinedViews: false });
const computer = w({ documentId: "comp", title: "computer", slug: "computer", position: 4 });
const stuff = w({ documentId: "stuff", title: "stuff", slug: "stuff", position: 5, systemKey: "stuff" });
const worlds = [lifeStuff, dayJob, computer, stuff];

const idsOf = (scope: Parameters<typeof resolveVisibleWorldIds>[0]) =>
  [...resolveVisibleWorldIds(scope, worlds)].sort();

describe("resolveVisibleWorldIds", () => {
  it("'all' spans every world EXCEPT stuff", () => {
    expect(idsOf("all")).toEqual(["comp", "day", "life"]);
  });

  it("'combined' excludes day-job-like worlds and stuff", () => {
    expect(idsOf("combined")).toEqual(["comp", "life"]);
  });

  it("'excluded' is only the worlds kept out of combined views (day job)", () => {
    expect(idsOf("excluded")).toEqual(["day"]);
  });

  it("{ systemKey: 'stuff' } names the stuff world explicitly", () => {
    expect(idsOf({ systemKey: "stuff" })).toEqual(["stuff"]);
  });

  it("{ worldId } targets one world — including stuff when named", () => {
    expect(idsOf({ worldId: "life" })).toEqual(["life"]);
    expect(idsOf({ worldId: "stuff" })).toEqual(["stuff"]);
  });

  it("never leaks the stuff world into an aggregate scope", () => {
    for (const scope of ["all", "combined", "excluded"] as const) {
      expect([...resolveVisibleWorldIds(scope, worlds)]).not.toContain("stuff");
    }
  });
});

describe("resolveVisibleWorlds", () => {
  it("preserves input order (the `worlds` array is already position-sorted upstream)", () => {
    // worlds is [life(2), day(3), comp(4), stuff(5)] → 'all' drops stuff.
    expect(resolveVisibleWorlds("all", worlds).map((x) => x.documentId)).toEqual(["life", "day", "comp"]);
  });

  it("sortWorldsByPosition orders by position", () => {
    const sorted = sortWorldsByPosition([computer, lifeStuff, dayJob]);
    expect(sorted.map((x) => x.documentId)).toEqual(["life", "day", "comp"]);
  });
});

describe("lookups", () => {
  it("findWorldBySlug matches on slug", () => {
    expect(findWorldBySlug("day-job", worlds)?.documentId).toBe("day");
    expect(findWorldBySlug("nope", worlds)).toBeUndefined();
  });

  it("findStuffWorld finds the systemKey world", () => {
    expect(findStuffWorld(worlds)?.documentId).toBe("stuff");
    expect(findStuffWorld([lifeStuff, dayJob])).toBeUndefined();
  });
});
