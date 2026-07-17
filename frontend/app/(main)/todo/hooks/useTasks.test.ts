import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Task, Project } from "@/app/types/index";

// Mocks must be declared before importing the hook so vi.mock hoists correctly.
vi.mock("@/app/lib/showsTaskCreator", () => ({
  createTasksFromShows: vi
    .fn()
    .mockResolvedValue({ success: true, tasksCreated: 0, showsProcessed: 0 }),
}));

import { useTasks } from "./useTasks";
import { DateTimeSettingsProvider } from "@/app/contexts/DateTimeSettingsContext";

// useTasks reads its timezone, day boundary and visibility window from the
// provider. Supplying `initial` keeps the provider from fetching, so the fetch
// assertions below still only see the hook's own calls — and it's why the
// visibility config no longer needs mocking at all.
//
// The tasks and projects queries live in the cache, so each test gets its own
// QueryClient (a shared one would leak data between tests). `retry: false` is the
// one deliberate divergence from the app's defaults — retrying a deliberate
// failure just makes the test sit through a backoff. staleTime mirrors the real
// QueryProvider; gcTime is left alone, since 0 would evict a query the moment it
// loses its last observer.
let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      DateTimeSettingsProvider,
      {
        initial: {
          timeZoneSettings: { timezone: "America/New_York", dayBoundaryHour: 4 },
          completedTaskVisibilityMinutes: 15,
        },
      },
      children
    )
  );

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 0,
    documentId: "task-1",
    title: "Test",
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: null,
    displayDateOffset: null,
    isRecurring: false,
    recurrenceType: "none",
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    project: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    createdAt: "",
    updatedAt: "",
    publishedAt: "",
    ...overrides,
  }) as Task;

const makeProject = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 0,
    documentId: "proj-1",
    title: "Bird Catcher Remix EP",
    description: null,
    world: "make music",
    importance: "normal",
    createdAt: "",
    updatedAt: "",
    publishedAt: "",
    ...overrides,
  }) as Project;

// Wait for the hook's mount-time fetch to resolve before each assertion so we
// don't race with the loading state.
async function settle() {
  await waitFor(() => {
    // nothing — used only to flush effects
  });
}

describe("useTasks", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  // /api/tasks and /api/projects are two independent queries now, so they may
  // resolve in either order. Every mock answers by URL rather than by call
  // sequence — a `mockResolvedValueOnce` here would hand the tasks payload to
  // whichever query happened to fire first.
  const mockApi = ({ tasks = [], projects = [] }: { tasks?: Task[]; projects?: Project[] }) =>
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: String(url).startsWith("/api/projects") ? projects : tasks,
        }),
      })
    );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 30_000 },
        mutations: { retry: false },
      },
    });
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    mockApi({});
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  // The visibility window used to live in a module cache that nothing primed on
  // the first load, so /todo hid tasks the user had just completed until they
  // visited /settings. The old suite tested that cache and reimplemented the
  // comparison inline; these drive the real filter with the window the provider
  // supplies (15 minutes, per `wrapper`).
  describe("completed-task visibility window", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("keeps a task completed inside the window", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      const task = makeTask({
        documentId: "recent",
        completed: true,
        completedAt: "2026-01-08T16:50:00.000Z", // 10 minutes ago, window is 15
      });
      mockApi({ tasks: [task] });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks.map((t) => t.documentId)).toEqual(["recent"]);
    });

    it("drops a task completed beyond the window", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      const task = makeTask({
        documentId: "stale",
        completed: true,
        completedAt: "2026-01-08T13:46:00.000Z", // 194 minutes ago
      });
      mockApi({ tasks: [task] });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(0);
    });
  });

  // A long task worked on today drops out of the main views once it passes the
  // visibility window but before the day rolls over ("phase 2"). Drives the real
  // getWorkedOnPhase — the suite this replaced mocked it and asserted on a copy
  // of the rule reimplemented in the test file.
  describe("worked-on phase filtering", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const longTaskWorkedAt = (timestamp: string) =>
      makeTask({
        documentId: "long-1",
        long: true,
        workSessions: [{ date: "2026-01-08", timestamp }],
      });

    it("keeps a long task worked on inside the window (phase 1)", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      // 5 minutes ago, window is 15
      mockApi({ tasks: [longTaskWorkedAt("2026-01-08T16:55:00.000Z")] });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].workedOnPhase).toBe(1);
    });

    it("drops a long task past the window on the same day (phase 2)", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      // 60 minutes ago: past the 15-minute window, still the same effective day
      mockApi({ tasks: [longTaskWorkedAt("2026-01-08T16:00:00.000Z")] });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(0);
    });

    it("keeps a long task worked on a previous day (phase 3)", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      // Yesterday: past the window, but the day rolled over, so it comes back
      mockApi({ tasks: [longTaskWorkedAt("2026-01-07T16:00:00.000Z")] });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].workedOnPhase).toBe(3);
    });
  });

  it("loads tasks on mount and exposes them", async () => {
    const task = makeTask({ documentId: "a", title: "First" });
    mockApi({ tasks: [task] });

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].documentId).toBe("a");
  });

  it("addTask appends a task without refetching", async () => {
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const fetchCallsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      result.current.addTask(makeTask({ documentId: "new", title: "Added" }));
    });

    // The mutators write to the query cache, and TanStack notifies observers on a
    // microtask, so `result.current` is not refreshed the instant act() returns.
    // Assertions on a mutator's effect have to retry rather than read once.
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0].documentId).toBe("new");
    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
  });

  it("removeTask drops the matching task", async () => {
    mockApi({ tasks: [
          makeTask({ documentId: "a" }),
          makeTask({ documentId: "b" }),
        ] });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    await act(async () => {
      result.current.removeTask("a");
    });

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0].documentId).toBe("b");
  });

  it("updateTask replaces the matching task by documentId", async () => {
    mockApi({ tasks: [makeTask({ documentId: "a", title: "Old" })] });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      result.current.updateTask(
        makeTask({ documentId: "a", title: "New", completed: true })
      );
    });

    await waitFor(() => expect(result.current.tasks[0].title).toBe("New"));
    expect(result.current.tasks[0].completed).toBe(true);
  });

  it("grouped derives projects and incidentals from tasks", async () => {
    const project = makeProject();
    mockApi({ tasks: [
          makeTask({ documentId: "a", project: project as any }),
          makeTask({ documentId: "c" }),
        ] });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    expect(result.current.grouped.projects).toHaveLength(1);
    expect(result.current.grouped.projects[0].documentId).toBe(project.documentId);
    expect(result.current.grouped.projects[0].tasks).toHaveLength(1);

    // Category grouping is retired: everything project-less is an incidental.
    expect(result.current.grouped.categoryGroups).toHaveLength(0);

    expect(result.current.grouped.incidentals).toHaveLength(1);
    expect(result.current.grouped.incidentals[0].documentId).toBe("c");
  });

  describe("projects with no tasks", () => {
    it("addProject shows a new empty project immediately", async () => {
      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        result.current.addProject(makeProject({ documentId: "empty-1" }));
      });

      await waitFor(() => expect(result.current.grouped.projects).toHaveLength(1));
      expect(result.current.grouped.projects[0].documentId).toBe("empty-1");
      expect(result.current.grouped.projects[0].tasks).toEqual([]);
    });

    it("keeps an empty project across a refetch", async () => {
      // The overlay this replaced was cleared on every refetch, so a project you
      // had just created vanished — and would vanish on window focus now.
      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApi({ tasks: [], projects: [makeProject({ documentId: "empty-1" })] });
      await act(async () => {
        await result.current.refetch(false);
      });

      await waitFor(() => expect(result.current.grouped.projects).toHaveLength(1));
      expect(result.current.grouped.projects[0].documentId).toBe("empty-1");
      expect(result.current.grouped.projects[0].tasks).toEqual([]);
    });

    it("carries the project's own world, not the task's shallow copy", async () => {
      // /api/projects is the authoritative record (it populates `world`);
      // /api/tasks only shallow-populates the relation. The seeded copy wins.
      const withWorld = makeProject({
        documentId: "proj-1",
        world: { documentId: "w1", title: "make music", systemKey: null },
      } as Partial<Project>);
      mockApi({
        tasks: [makeTask({ documentId: "a", project: { documentId: "proj-1" } as any })],
        projects: [withWorld],
      });

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const project = result.current.grouped.projects.find((p) => p.documentId === "proj-1");
      expect(project?.world?.title).toBe("make music");
      expect(project?.tasks).toHaveLength(1);
    });
  });

  it("updateProject propagates new metadata to tasks that reference the project", async () => {
    const project = makeProject({ documentId: "p1", title: "Old name" });
    mockApi({ tasks: [makeTask({ documentId: "a", project: project as any })] });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    expect(result.current.grouped.projects[0].title).toBe("Old name");

    await act(async () => {
      result.current.updateProject(
        makeProject({ documentId: "p1", title: "New name" })
      );
    });

    await waitFor(() =>
      expect((result.current.tasks[0].project as any).title).toBe("New name")
    );
    expect(result.current.grouped.projects[0].title).toBe("New name");
  });

  /**
   * The reported bug: promote one project while another is top of mind, and Good
   * Morning showed both until a reload.
   *
   * `updateProject` above patches by documentId, which is all a rename needs —
   * and a rename is all it was ever tested for. A promotion also changes a
   * project the response never mentions, because the server demotes the
   * incumbent behind a request that names only the promoted one. The routes now
   * return those ids and this applies them.
   *
   * Importance is read off `task.project` by `taskTier` and off the projects
   * list by the column ordering, so both copies have to land or the section and
   * the columns disagree.
   */
  describe("demoteProjects", () => {
    const promoted = () =>
      makeProject({ documentId: "p-new", title: "New", importance: "top of mind" });
    const incumbent = () =>
      makeProject({ documentId: "p-old", title: "Old", importance: "top of mind" });

    it("clears 'top of mind' in the projects list and on every task's project relation", async () => {
      mockApi({
        tasks: [
          makeTask({ documentId: "t-old", project: incumbent() as any }),
          makeTask({ documentId: "t-new", project: promoted() as any }),
        ],
        projects: [incumbent(), promoted()],
      });

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.tasks).toHaveLength(2));

      await act(async () => {
        result.current.demoteProjects(["p-old"]);
      });

      // A cache write is not visible to result.current when act() returns —
      // TanStack notifies observers on a microtask.
      await waitFor(() =>
        expect(
          (result.current.tasks.find((t) => t.documentId === "t-old")!.project as any).importance
        ).toBe("normal")
      );
      expect(
        result.current.grouped.projects.find((p) => p.documentId === "p-old")?.importance
      ).toBe("normal");
    });

    it("leaves the promoted project alone", async () => {
      mockApi({
        tasks: [makeTask({ documentId: "t-new", project: promoted() as any })],
        projects: [incumbent(), promoted()],
      });

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      await act(async () => {
        result.current.demoteProjects(["p-old"]);
      });

      await waitFor(() =>
        expect(
          result.current.grouped.projects.find((p) => p.documentId === "p-old")?.importance
        ).toBe("normal")
      );
      expect(
        result.current.grouped.projects.find((p) => p.documentId === "p-new")?.importance
      ).toBe("top of mind");
      expect((result.current.tasks[0].project as any).importance).toBe("top of mind");
    });

    it("demotes several projects at once", async () => {
      const second = makeProject({ documentId: "p-old-2", importance: "top of mind" });
      mockApi({ projects: [incumbent(), second, promoted()] });

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.grouped.projects).toHaveLength(3));

      await act(async () => {
        result.current.demoteProjects(["p-old", "p-old-2"]);
      });

      await waitFor(() => {
        const byId = Object.fromEntries(
          result.current.grouped.projects.map((p) => [p.documentId, p.importance])
        );
        expect(byId["p-old"]).toBe("normal");
        expect(byId["p-old-2"]).toBe("normal");
        expect(byId["p-new"]).toBe("top of mind");
      });
    });

    it("does not advance dataUpdatedAt", async () => {
      // The filter's `now` is the tasks query's dataUpdatedAt — "when the server
      // last told us this". A bare setQueryData stamps the cache with the
      // current time, which is what made a just-completed task vanish on click
      // under a 0-minute visibility window. Only a real fetch may move it.
      mockApi({
        tasks: [makeTask({ documentId: "t-old", project: incumbent() as any })],
        projects: [incumbent()],
      });

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      const before = queryClient.getQueryState(["tasks", "active"])?.dataUpdatedAt;
      await act(async () => {
        result.current.demoteProjects(["p-old"]);
      });
      await waitFor(() =>
        expect((result.current.tasks[0].project as any).importance).toBe("normal")
      );

      expect(queryClient.getQueryState(["tasks", "active"])?.dataUpdatedAt).toBe(before);
    });

    it("is a no-op for an empty list", async () => {
      mockApi({ projects: [incumbent()] });

      const { result } = renderHook(() => useTasks(), { wrapper });
      await waitFor(() => expect(result.current.grouped.projects).toHaveLength(1));

      await act(async () => {
        result.current.demoteProjects([]);
      });

      expect(result.current.grouped.projects[0].importance).toBe("top of mind");
    });
  });
});
