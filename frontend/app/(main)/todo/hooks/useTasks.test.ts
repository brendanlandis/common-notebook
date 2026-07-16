import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
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
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    DateTimeSettingsProvider,
    {
      initial: {
        timeZoneSettings: { timezone: "America/New_York", dayBoundaryHour: 4 },
        completedTaskVisibilityMinutes: 15,
      },
    },
    children
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

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
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
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [task] }),
      });

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
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [task] }),
      });

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
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [longTaskWorkedAt("2026-01-08T16:55:00.000Z")],
        }),
      });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].workedOnPhase).toBe(1);
    });

    it("drops a long task past the window on the same day (phase 2)", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      // 60 minutes ago: past the 15-minute window, still the same effective day
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [longTaskWorkedAt("2026-01-08T16:00:00.000Z")],
        }),
      });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(0);
    });

    it("keeps a long task worked on a previous day (phase 3)", async () => {
      vi.setSystemTime(new Date("2026-01-08T17:00:00.000Z"));
      // Yesterday: past the window, but the day rolled over, so it comes back
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [longTaskWorkedAt("2026-01-07T16:00:00.000Z")],
        }),
      });

      const { result } = renderHook(() => useTasks(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].workedOnPhase).toBe(3);
    });
  });

  it("loads tasks on mount and exposes them", async () => {
    const task = makeTask({ documentId: "a", title: "First" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [task] }),
    });

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].documentId).toBe("a");
  });

  it("addTask appends a task without refetching", async () => {
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const fetchCallsBefore = fetchMock.mock.calls.length;

    act(() => {
      result.current.addTask(makeTask({ documentId: "new", title: "Added" }));
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].documentId).toBe("new");
    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
  });

  it("removeTask drops the matching task", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          makeTask({ documentId: "a" }),
          makeTask({ documentId: "b" }),
        ],
      }),
    });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    act(() => {
      result.current.removeTask("a");
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].documentId).toBe("b");
  });

  it("updateTask replaces the matching task by documentId", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [makeTask({ documentId: "a", title: "Old" })],
      }),
    });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    act(() => {
      result.current.updateTask(
        makeTask({ documentId: "a", title: "New", completed: true })
      );
    });

    expect(result.current.tasks[0].title).toBe("New");
    expect(result.current.tasks[0].completed).toBe(true);
  });

  it("grouped derives projects and incidentals from tasks", async () => {
    const project = makeProject();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          makeTask({ documentId: "a", project: project as any }),
          makeTask({ documentId: "c" }),
        ],
      }),
    });

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

  it("addManualProject shows an empty project until refetch", async () => {
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addManualProject(makeProject({ documentId: "empty-1" }));
    });

    expect(result.current.grouped.projects).toHaveLength(1);
    expect(result.current.grouped.projects[0].documentId).toBe("empty-1");
    expect(result.current.grouped.projects[0].tasks).toEqual([]);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    await act(async () => {
      await result.current.refetch(false);
    });

    expect(result.current.grouped.projects).toHaveLength(0);
  });

  it("updateProject propagates new metadata to tasks that reference the project", async () => {
    const project = makeProject({ documentId: "p1", title: "Old name" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [makeTask({ documentId: "a", project: project as any })],
      }),
    });

    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    expect(result.current.grouped.projects[0].title).toBe("Old name");

    act(() => {
      result.current.updateProject(
        makeProject({ documentId: "p1", title: "New name" })
      );
    });

    expect((result.current.tasks[0].project as any).title).toBe("New name");
    expect(result.current.grouped.projects[0].title).toBe("New name");
  });
});
