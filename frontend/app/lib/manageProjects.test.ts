import { describe, expect, it } from "vitest";
import type { Project, Task, World } from "@/app/types/index";
import { doneCandidates, orderDoneCandidates, groupProjectsByWorld, NO_WORLD_KEY } from "./manageProjects";

const world = (id: string, title: string, position = 0): World => ({
  id: Number(id.replace(/\D/g, "")) || 1,
  documentId: id,
  title,
  slug: title,
  position,
  systemKey: null,
});

const project = (over: Partial<Project> & { documentId: string }): Project => ({
  id: 1,
  title: over.documentId,
  description: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  publishedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const task = (documentId: string, completed: boolean, projectId: string | null): Task =>
  ({
    documentId,
    completed,
    project: projectId ? ({ documentId: projectId } as Project) : null,
  } as Task);

const completedTask = (projectId: string, completedAt: string): Task =>
  ({ documentId: "d", completed: true, completedAt, project: { documentId: projectId } as Project } as Task);

describe("doneCandidates", () => {
  it("includes a project whose only tasks are complete", () => {
    const p = project({ documentId: "p1" });
    const result = doneCandidates([p], [task("t1", true, "p1")]);
    expect(result.map((r) => r.documentId)).toEqual(["p1"]);
  });

  it("includes an empty project (no tasks at all)", () => {
    const p = project({ documentId: "p1" });
    expect(doneCandidates([p], []).map((r) => r.documentId)).toEqual(["p1"]);
  });

  it("excludes a project with an incomplete task", () => {
    const p = project({ documentId: "p1" });
    expect(doneCandidates([p], [task("t1", false, "p1")])).toEqual([]);
  });

  it("excludes a project with a live recurring task (recurring tasks are incomplete in the active list)", () => {
    const p = project({ documentId: "p1" });
    // A recurring task carries completed:false, so it registers as incomplete work.
    expect(doneCandidates([p], [task("t1", false, "p1")])).toEqual([]);
  });

  it("excludes an already-complete project even with no incomplete tasks", () => {
    const p = project({ documentId: "p1", complete: true });
    expect(doneCandidates([p], [task("t1", true, "p1")])).toEqual([]);
  });

  it("ignores incidental (project-less) tasks", () => {
    const p = project({ documentId: "p1" });
    expect(doneCandidates([p], [task("t1", false, null)]).map((r) => r.documentId)).toEqual(["p1"]);
  });
});

describe("orderDoneCandidates", () => {
  it("orders by most recent task completion, newest first", () => {
    const a = project({ documentId: "a" });
    const b = project({ documentId: "b" });
    const c = project({ documentId: "c" });
    const completed = [
      completedTask("a", "2026-01-10T00:00:00.000Z"),
      completedTask("b", "2026-03-01T00:00:00.000Z"),
      completedTask("a", "2026-02-15T00:00:00.000Z"), // a's most recent
      completedTask("c", "2026-01-01T00:00:00.000Z"),
    ];
    const ordered = orderDoneCandidates([a, b, c], completed);
    expect(ordered.map((p) => p.documentId)).toEqual(["b", "a", "c"]);
  });

  it("sorts candidates with no completion in the window to the bottom, stably", () => {
    const dated = project({ documentId: "dated" });
    const empty1 = project({ documentId: "empty1" });
    const empty2 = project({ documentId: "empty2" });
    const ordered = orderDoneCandidates(
      [empty1, dated, empty2],
      [completedTask("dated", "2026-02-01T00:00:00.000Z")]
    );
    expect(ordered.map((p) => p.documentId)).toEqual(["dated", "empty1", "empty2"]);
  });
});

describe("groupProjectsByWorld", () => {
  const wA = world("wa", "day job", 0);
  const wB = world("wb", "life stuff", 1);

  it("groups by world in world order, no-world bucket last", () => {
    const projects = [
      project({ documentId: "p-b", world: wB }),
      project({ documentId: "p-none", world: null }),
      project({ documentId: "p-a", world: wA }),
    ];
    const groups = groupProjectsByWorld(projects, [wA, wB]);
    expect(groups.map((g) => g.key)).toEqual(["wa", "wb", NO_WORLD_KEY]);
    expect(groups[2].label).toBe("no world");
  });

  it("omits worlds that have no projects", () => {
    const projects = [project({ documentId: "p-a", world: wA })];
    const groups = groupProjectsByWorld(projects, [wA, wB]);
    expect(groups.map((g) => g.key)).toEqual(["wa"]);
  });

  it("excludes completed projects", () => {
    const projects = [
      project({ documentId: "p-a", world: wA }),
      project({ documentId: "p-done", world: wA, complete: true }),
    ];
    const groups = groupProjectsByWorld(projects, [wA]);
    expect(groups[0].projects.map((p) => p.documentId)).toEqual(["p-a"]);
  });

  it("orders within a world by tier: top of mind before normal", () => {
    const projects = [
      project({ documentId: "p-normal", world: wA, importance: "normal" }),
      project({ documentId: "p-top", world: wA, importance: "top of mind" }),
    ];
    const groups = groupProjectsByWorld(projects, [wA]);
    expect(groups[0].projects.map((p) => p.documentId)).toEqual(["p-top", "p-normal"]);
  });
});
