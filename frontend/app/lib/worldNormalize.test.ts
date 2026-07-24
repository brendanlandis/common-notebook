import { describe, it, expect } from "vitest";
import { toStrapiProjectWrite, normalizeProjectWorld } from "./worldNormalize";

// Regression guard for the world-wipe bug: a partial project PUT that did not
// mention `world` used to emit `worldRef: null`, which told Strapi to clear the
// relation — so changing importance, completing, or reviving a project silently
// erased its world. The write side must only touch `worldRef` when the caller
// actually supplied a world.
describe("toStrapiProjectWrite", () => {
  it("omits worldRef entirely on an importance-only partial update", () => {
    const out = toStrapiProjectWrite({ importance: "top of mind" });
    expect("worldRef" in out).toBe(false);
    expect(out).toEqual({ importance: "top of mind" });
  });

  it("omits worldRef on a complete-only partial update", () => {
    const out = toStrapiProjectWrite({ complete: true, completedAt: "2026-07-24T00:00:00.000Z" });
    expect("worldRef" in out).toBe(false);
  });

  it("omits worldRef on a revive-only partial update", () => {
    const out = toStrapiProjectWrite({ complete: false, completedAt: null });
    expect("worldRef" in out).toBe(false);
  });

  it("maps a provided world documentId onto worldRef and drops the `world` key", () => {
    const out = toStrapiProjectWrite({ title: "x", world: "w1" });
    expect(out).toEqual({ title: "x", worldRef: "w1" });
    expect("world" in out).toBe(false);
  });

  it("treats an empty-string world as an explicit 'no world' (clears the relation)", () => {
    expect(toStrapiProjectWrite({ world: "" })).toEqual({ worldRef: null });
  });

  it("treats an explicit null world as 'no world' (clears the relation)", () => {
    expect(toStrapiProjectWrite({ world: null })).toEqual({ worldRef: null });
  });

  it("accepts a caller that already speaks worldRef", () => {
    expect(toStrapiProjectWrite({ worldRef: "w2" })).toEqual({ worldRef: "w2" });
  });

  it("handles a nullish body", () => {
    expect(toStrapiProjectWrite(undefined)).toEqual({});
  });
});

describe("normalizeProjectWorld (round-trip sanity)", () => {
  it("reads worldRef into `world` and drops the legacy enum", () => {
    const raw = { documentId: "p1", title: "x", world: "computer", worldRef: { documentId: "w1" } };
    const out = normalizeProjectWorld(raw);
    expect(out.world).toEqual({ documentId: "w1" });
    expect((out as Record<string, unknown>).worldRef).toBeUndefined();
  });

  it("yields world: null when the relation is empty", () => {
    expect(normalizeProjectWorld({ documentId: "p1", worldRef: null }).world).toBeNull();
  });
});
