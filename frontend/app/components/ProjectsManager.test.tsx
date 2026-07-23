import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Project, Task, World } from "@/app/types/index";

// Mock the data hooks + ProjectForm so the test exercises ProjectsManager's own
// wiring (section layout, expand, mark-complete/revive) against real section
// logic (doneCandidates/groupProjectsByWorld run for real).

const wa: World = { id: 1, documentId: "wa", title: "day job", slug: "day-job", position: 0, systemKey: null };
const wStuff: World = { id: 9, documentId: "wstuff", title: "stuff", slug: "stuff", position: 9, systemKey: "stuff" };

const proj = (over: Partial<Project> & { documentId: string; title: string }): Project => ({
  id: 1,
  description: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  publishedAt: "2026-01-01T00:00:00.000Z",
  world: wa,
  importance: "normal",
  ...over,
});

const projects: Project[] = [
  proj({ documentId: "p-empty", title: "Empty Proj" }),
  proj({ documentId: "p-busy", title: "Busy Proj" }),
  proj({ documentId: "p-top", title: "Top Proj", importance: "top of mind" }),
  proj({ documentId: "p-later", title: "Later Proj", importance: "later" }),
  // A stuff-world project: must be excluded from sections 1-3.
  proj({ documentId: "p-stuff", title: "Stuff Proj", world: wStuff }),
];
const tasks = [{ documentId: "t1", completed: false, project: { documentId: "p-busy" } } as unknown as Task];

vi.mock("@/app/(main)/todo/hooks/useTasks", () => ({
  useTasks: () => ({ grouped: { projects }, tasks, loading: false }),
}));
vi.mock("@/app/hooks/useWorlds", () => ({
  useWorlds: () => ({ worlds: [wa, wStuff] }),
}));
vi.mock("@/app/contexts/StuffProjectsContext", () => ({
  useStuffProjects: () => ({ stuffProjectsEnabled: true, setStuffProjectsEnabled: vi.fn() }),
}));

const completeProject = vi.fn().mockResolvedValue(undefined);
const reviveProject = vi.fn().mockResolvedValue(undefined);
const setImportance = vi.fn().mockResolvedValue(undefined);
const saveProject = vi.fn().mockResolvedValue(undefined);

vi.mock("@/app/hooks/useManageProjects", () => ({
  useManageProjects: () => ({
    completedProjects: [proj({ documentId: "c1", title: "Old Proj", complete: true })],
    recentlyCompletedTasks: [],
    completedLoading: false,
    completedError: null,
    fetchMoreCompleted: vi.fn(),
    hasMoreCompleted: false,
    fetchingMoreCompleted: false,
    completeProject,
    reviveProject,
    setImportance,
    saveProject,
    busy: false,
  }),
}));

vi.mock("@/app/(main)/todo/components/ProjectForm", () => ({
  default: ({ project }: { project: Project }) => (
    <div data-testid="project-form">form:{project.documentId}</div>
  ),
}));

import ProjectsManager from "./ProjectsManager";

beforeEach(() => {
  completeProject.mockClear();
  reviveProject.mockClear();
});

describe("ProjectsManager", () => {
  it("renders all four sections", () => {
    render(<ProjectsManager />);
    expect(screen.getByText("are these done yet?")).toBeTruthy();
    expect(screen.getByText("importance")).toBeTruthy();
    expect(screen.getByText("manage all projects")).toBeTruthy();
    expect(screen.getByText("revive old projects")).toBeTruthy();
  });

  it("prefixes section-1 candidates with their world", () => {
    render(<ProjectsManager />);
    // p-empty is a candidate (no tasks) in world "day job".
    expect(screen.getByText("day job: Empty Proj")).toBeTruthy();
  });

  it("excludes stuff-world projects from sections 1-3", () => {
    render(<ProjectsManager />);
    // p-stuff has no tasks, so without the filter it would be a §1 candidate and
    // a §3 row. It must appear nowhere in the manage lists.
    expect(screen.queryByText(/Stuff Proj/)).toBeNull();
  });

  it("section 1 lists done candidates (empty projects included) and marks one complete", () => {
    render(<ProjectsManager />);
    const markButtons = screen.getAllByRole("button", { name: "mark complete" });
    // p-busy has an incomplete task; the other three are candidates.
    expect(markButtons.length).toBe(3);
    fireEvent.click(markButtons[0]);
    expect(completeProject).toHaveBeenCalledTimes(1);
  });

  it("section 3 worlds are accordions; expanding a world then a project shows the form", () => {
    render(<ProjectsManager />);
    // World collapsed by default — its project rows aren't in the DOM yet.
    expect(screen.queryByRole("button", { name: "Busy Proj" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "day job" })); // open the world
    expect(screen.queryByTestId("project-form")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Busy Proj" })); // open the project
    expect(screen.getByTestId("project-form").textContent).toContain("p-busy");
  });

  it("section 4 lists completed projects by default and revives one", () => {
    render(<ProjectsManager />);
    // Shown without expanding — the completed list is visible immediately.
    expect(screen.getByText("Old Proj")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "revive" }));
    expect(reviveProject).toHaveBeenCalledWith("c1");
  });
});
