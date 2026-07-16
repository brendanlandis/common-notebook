import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { Task, Project } from "@/app/types/index";

// Mocks must be declared before importing the hook so vi.mock hoists correctly.
vi.mock("@/app/lib/completedTaskVisibilityConfig", () => ({
  fetchVisibilityMinutesFromStrapi: vi.fn().mockResolvedValue(undefined),
  getCompletedTaskVisibilityMinutes: vi.fn().mockReturnValue(15),
}));

vi.mock("@/app/lib/showsTaskCreator", () => ({
  createTasksFromShows: vi
    .fn()
    .mockResolvedValue({ success: true, tasksCreated: 0, showsProcessed: 0 }),
}));

import { useTasks } from "./useTasks";
import { DateTimeSettingsProvider } from "@/app/contexts/DateTimeSettingsContext";

// useTasks reads its timezone and day boundary from the provider. Supplying
// `initial` keeps the provider from fetching, so the fetch assertions below
// still only see the hook's own calls.
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    DateTimeSettingsProvider,
    { initial: { timezone: "America/New_York", dayBoundaryHour: 4 } },
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
