import { describe, it, expect } from "vitest";
import { viewToRuleset, sortViewsByPosition, findViewBySlug, CODE_PRESETS, findCodePreset } from "./views";
import type { View, World } from "@/app/types/index";

const music: World = { id: 1, documentId: "w-music", title: "make music", slug: "make-music", position: 0, systemKey: null };
const dayJob: World = { id: 2, documentId: "w-day", title: "day job", slug: "day-job", position: 1, systemKey: null };

function view(overrides: Partial<View>): View {
  return {
    id: 1,
    documentId: "v-1",
    name: "a view",
    slug: "a-view",
    position: 0,
    systemKey: null,
    layout: "projects",
    sections: [],
    ...overrides,
  };
}

describe("viewToRuleset", () => {
  it("carries slug, name, layout, systemKey and maps each section's worlds to documentIds", () => {
    const v = view({
      slug: "good-morning",
      name: "good morning",
      layout: "projects",
      systemKey: null,
      sections: [
        {
          name: "top of mind",
          worldMode: "all",
          worlds: [],
          importance: "soonAndTopOfMind",
          projectType: "any",
          recurrence: "nonRecurring",
          longOnly: false,
        },
        {
          name: "recurring",
          worldMode: "except",
          worlds: [dayJob],
          importance: "any",
          projectType: "any",
          recurrence: "recurring",
          longOnly: false,
        },
      ],
    });

    const ruleset = viewToRuleset(v);
    expect(ruleset.slug).toBe("good-morning");
    expect(ruleset.name).toBe("good morning");
    expect(ruleset.layout).toBe("projects");
    expect(ruleset.sections).toHaveLength(2);
    expect(ruleset.sections[0]).toMatchObject({ name: "top of mind", worldMode: "all", worldIds: [], importance: "soonAndTopOfMind", recurrence: "nonRecurring" });
    expect(ruleset.sections[1]).toMatchObject({ name: "recurring", worldMode: "except", worldIds: ["w-day"], recurrence: "recurring" });
  });

  it("carries the stuff systemKey (gates the projects wishlist split)", () => {
    const v = view({ slug: "stuff", systemKey: "stuff", sections: [{ name: null, worldMode: "only", worlds: [music], importance: "any", projectType: "any", recurrence: "nonRecurring", longOnly: false }] });
    const ruleset = viewToRuleset(v);
    expect(ruleset.systemKey).toBe("stuff");
    expect(ruleset.sections[0].worldIds).toEqual(["w-music"]);
  });

  it("falls back to a single passthrough section when a view has none", () => {
    const ruleset = viewToRuleset(view({ sections: [] }));
    expect(ruleset.sections).toHaveLength(1);
    expect(ruleset.sections[0]).toMatchObject({ worldMode: "all", importance: "any", recurrence: "both" });
  });
});

describe("helpers", () => {
  it("sortViewsByPosition orders by position, stable on ties", () => {
    const a = view({ documentId: "a", position: 2 });
    const b = view({ documentId: "b", position: 0 });
    const c = view({ documentId: "c", position: 0 });
    expect(sortViewsByPosition([a, b, c]).map((v) => v.documentId)).toEqual(["b", "c", "a"]);
  });

  it("findViewBySlug matches on slug", () => {
    const v = view({ slug: "later" });
    expect(findViewBySlug("later", [v])?.documentId).toBe("v-1");
    expect(findViewBySlug("nope", [v])).toBeUndefined();
  });

  it("CODE_PRESETS are done + recurring; recurring ignores displayDate", () => {
    expect(CODE_PRESETS.map((p) => p.slug).sort()).toEqual(["done", "recurring"]);
    expect(findCodePreset("done")?.codePreset).toBe("done");
    expect(findCodePreset("recurring")?.ignoreDisplayDate).toBe(true);
    expect(findCodePreset("good-morning")).toBeUndefined();
  });
});
