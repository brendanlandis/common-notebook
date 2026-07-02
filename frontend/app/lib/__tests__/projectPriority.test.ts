import { describe, it, expect } from "vitest";
import { getProjectPriority } from "@/app/lib/projectPriority";

describe("getProjectPriority", () => {
  it("matches a whole-word pN token", () => {
    expect(getProjectPriority("Migrate DB p1")).toBe(1);
    expect(getProjectPriority("p2 Rewrite auth")).toBe(2);
    expect(getProjectPriority("Backlog p10 cleanup")).toBe(10);
  });

  it("is case-insensitive", () => {
    expect(getProjectPriority("Ship it P1")).toBe(1);
    expect(getProjectPriority("Ship it P3")).toBe(3);
  });

  it("matches regardless of surrounding punctuation", () => {
    expect(getProjectPriority("Launch (p1):")).toBe(1);
    expect(getProjectPriority("p2, then rest")).toBe(2);
  });

  it("does not match substrings that aren't whole words", () => {
    expect(getProjectPriority("revamp1 website")).toBeNull();
    expect(getProjectPriority("wrap1up")).toBeNull();
  });

  it("does not match a bare 'p' or non-numeric marker", () => {
    expect(getProjectPriority("just p here")).toBeNull();
    expect(getProjectPriority("pab task")).toBeNull();
  });

  it("returns the lowest number when multiple markers are present", () => {
    expect(getProjectPriority("p3 blocked by p1 work")).toBe(1);
    expect(getProjectPriority("p2 and p4")).toBe(2);
  });

  it("returns null for empty, undefined, or null titles", () => {
    expect(getProjectPriority("")).toBeNull();
    expect(getProjectPriority(undefined)).toBeNull();
    expect(getProjectPriority(null)).toBeNull();
  });
});
