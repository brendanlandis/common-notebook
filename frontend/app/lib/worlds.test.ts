import { describe, it, expect } from "vitest";
import {
  resolveVisibleWorldIds,
  resolveVisibleWorlds,
  findWorldBySlug,
  findStuffWorld,
  sortWorldsByPosition,
} from "./worlds";
import type { World, WorldMode } from "@/app/types/index";

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

const idsOf = (mode: WorldMode, ids: string[]) =>
  [...resolveVisibleWorldIds(mode, ids, worlds)].sort();

describe("resolveVisibleWorldIds", () => {
  it("'all' spans every world EXCEPT stuff", () => {
    expect(idsOf("all", [])).toEqual(["comp", "day", "life"]);
  });

  it("'except [day]' drops the named world and stuff (the old 'combined')", () => {
    expect(idsOf("except", ["day"])).toEqual(["comp", "life"]);
  });

  it("'except []' is every non-stuff world", () => {
    expect(idsOf("except", [])).toEqual(["comp", "day", "life"]);
  });

  it("'only [day]' targets just that world (the old 'excluded')", () => {
    expect(idsOf("only", ["day"])).toEqual(["day"]);
  });

  it("'only [stuff]' surfaces the stuff world (named explicitly)", () => {
    expect(idsOf("only", ["stuff"])).toEqual(["stuff"]);
  });

  it("'only [life, comp]' spans exactly the named worlds", () => {
    expect(idsOf("only", ["life", "comp"])).toEqual(["comp", "life"]);
  });

  it("never leaks the stuff world into 'all' or 'except'", () => {
    expect(idsOf("all", [])).not.toContain("stuff");
    expect(idsOf("except", [])).not.toContain("stuff");
    expect(idsOf("except", ["day"])).not.toContain("stuff");
  });
});

describe("resolveVisibleWorlds", () => {
  it("preserves input order (the `worlds` array is already position-sorted upstream)", () => {
    // worlds is [life(2), day(3), comp(4), stuff(5)] → 'all' drops stuff.
    expect(resolveVisibleWorlds("all", [], worlds).map((x) => x.documentId)).toEqual(["life", "day", "comp"]);
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
