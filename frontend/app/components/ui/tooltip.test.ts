import { describe, expect, it } from "vitest";
import { bubbleShift } from "@/app/components/ui/tooltip";

// keep 9: half of daisyUI's 10px tail, plus a 4px corner.
const fit = (center: number, width: number, left = 0, right = 1000) =>
  bubbleShift({ center, width, left, right, keep: 9 });

describe("bubbleShift", () => {
  it("leaves a bubble with room on both sides centered", () => {
    expect(fit(500, 100)).toBe(0);
  });

  it("moves a bubble running off the right back in, a gutter short of the edge", () => {
    // manage views, last in a 500px window's header
    expect(fit(464, 102, 0, 500)).toBe(-31);
  });

  it("moves a bubble running off the left back in", () => {
    // add task, first on a phone's second header line
    expect(fit(27, 67, 0, 393)).toBe(22.5);
  });

  it("keeps a bubble inside whatever clips it, not just the window", () => {
    // the menu's settings button, 32px in from a 320px drawer's right edge
    expect(fit(288, 64, 0, 320)).toBe(-16);
  });

  it("never leaves the tail outside the bubble", () => {
    // An element in the gutter itself: the bubble moves only as far as keeps
    // the tail 9px in from its edge.
    expect(fit(10, 60)).toBe(21);
  });

  it("keeps the start of a bubble too wide for the room in view", () => {
    expect(fit(100, 300, 0, 200)).toBe(66);
  });
});
