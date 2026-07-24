import { describe, it, expect } from "vitest";
import type { ViewSection } from "@/app/types/index";
import { sectionToInput } from "./viewSectionInput";

// View sections are Strapi components, replace-on-write: every section edit PUTs
// the whole rebuilt `sections` array, so `sectionToInput` must carry EVERY field
// across. This guards against silently dropping one (which would erase that field
// on the next section write — the same "lose data you didn't ask to" class as the
// worldRef bug).
describe("sectionToInput", () => {
  const fullSection: ViewSection = {
    id: 7,
    name: "top of mind",
    worldMode: "except",
    worlds: [
      { id: 4, documentId: "w-dayjob", title: "day job" } as ViewSection["worlds"][number],
      { id: 5, documentId: "w-life", title: "life stuff" } as ViewSection["worlds"][number],
    ],
    importance: "soonAndTopOfMind",
    projectType: "chores",
    recurrence: "nonRecurring",
    longOnly: true,
  };

  it("reproduces every field of a section", () => {
    expect(sectionToInput(fullSection)).toEqual({
      name: "top of mind",
      worldMode: "except",
      worlds: ["w-dayjob", "w-life"],
      importance: "soonAndTopOfMind",
      projectType: "chores",
      recurrence: "nonRecurring",
      longOnly: true,
    });
  });

  it("carries exactly the ViewSectionInput keys — no field silently dropped", () => {
    expect(Object.keys(sectionToInput(fullSection)).sort()).toEqual(
      ["importance", "longOnly", "name", "projectType", "recurrence", "worldMode", "worlds"].sort()
    );
  });

  it("maps a null name to undefined and an empty worlds list to []", () => {
    const out = sectionToInput({ ...fullSection, name: null, worlds: [] });
    expect(out.name).toBeUndefined();
    expect(out.worlds).toEqual([]);
  });
});
