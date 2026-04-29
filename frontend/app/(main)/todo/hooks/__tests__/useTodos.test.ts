import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Todo, Project } from "@/app/types/index";

// Mocks must be declared before importing the hook so vi.mock hoists correctly.
vi.mock("@/app/lib/completedTaskVisibilityConfig", () => ({
  fetchVisibilityMinutesFromStrapi: vi.fn().mockResolvedValue(undefined),
  getCompletedTaskVisibilityMinutes: vi.fn().mockReturnValue(15),
}));

vi.mock("@/app/lib/showsTodoCreator", () => ({
  createTodosFromShows: vi
    .fn()
    .mockResolvedValue({ success: true, todosCreated: 0, showsProcessed: 0 }),
}));

import { useTodos } from "../useTodos";

const makeTodo = (overrides: Partial<Todo> = {}): Todo =>
  ({
    id: 0,
    documentId: "todo-1",
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
    category: null,
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
  }) as Todo;

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

describe("useTodos", () => {
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

  it("loads todos on mount and exposes them", async () => {
    const todo = makeTodo({ documentId: "a", title: "First" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [todo] }),
    });

    const { result } = renderHook(() => useTodos());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.todos).toHaveLength(1);
    expect(result.current.todos[0].documentId).toBe("a");
  });

  it("addTodo appends a todo without refetching", async () => {
    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const fetchCallsBefore = fetchMock.mock.calls.length;

    act(() => {
      result.current.addTodo(makeTodo({ documentId: "new", title: "Added" }));
    });

    expect(result.current.todos).toHaveLength(1);
    expect(result.current.todos[0].documentId).toBe("new");
    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
  });

  it("removeTodo drops the matching todo", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          makeTodo({ documentId: "a" }),
          makeTodo({ documentId: "b" }),
        ],
      }),
    });

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.todos).toHaveLength(2));

    act(() => {
      result.current.removeTodo("a");
    });

    expect(result.current.todos).toHaveLength(1);
    expect(result.current.todos[0].documentId).toBe("b");
  });

  it("updateTodo replaces the matching todo by documentId", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [makeTodo({ documentId: "a", title: "Old" })],
      }),
    });

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.todos).toHaveLength(1));

    act(() => {
      result.current.updateTodo(
        makeTodo({ documentId: "a", title: "New", completed: true })
      );
    });

    expect(result.current.todos[0].title).toBe("New");
    expect(result.current.todos[0].completed).toBe(true);
  });

  it("grouped derives projects, category groups, and incidentals from todos", async () => {
    const project = makeProject();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          makeTodo({ documentId: "a", project: project as any }),
          makeTodo({
            documentId: "b",
            category: "home chores" as any,
          }),
          makeTodo({ documentId: "c" }),
        ],
      }),
    });

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.todos).toHaveLength(3));

    expect(result.current.grouped.projects).toHaveLength(1);
    expect(result.current.grouped.projects[0].documentId).toBe(project.documentId);
    expect(result.current.grouped.projects[0].todos).toHaveLength(1);

    expect(result.current.grouped.categoryGroups).toHaveLength(1);
    expect(result.current.grouped.categoryGroups[0].title).toBe("home chores");

    expect(result.current.grouped.incidentals).toHaveLength(1);
    expect(result.current.grouped.incidentals[0].documentId).toBe("c");
  });

  it("addManualProject shows an empty project until refetch", async () => {
    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.addManualProject(makeProject({ documentId: "empty-1" }));
    });

    expect(result.current.grouped.projects).toHaveLength(1);
    expect(result.current.grouped.projects[0].documentId).toBe("empty-1");
    expect(result.current.grouped.projects[0].todos).toEqual([]);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
    await act(async () => {
      await result.current.refetch(false);
    });

    expect(result.current.grouped.projects).toHaveLength(0);
  });

  it("updateProject propagates new metadata to todos that reference the project", async () => {
    const project = makeProject({ documentId: "p1", title: "Old name" });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [makeTodo({ documentId: "a", project: project as any })],
      }),
    });

    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.todos).toHaveLength(1));

    expect(result.current.grouped.projects[0].title).toBe("Old name");

    act(() => {
      result.current.updateProject(
        makeProject({ documentId: "p1", title: "New name" })
      );
    });

    expect((result.current.todos[0].project as any).title).toBe("New name");
    expect(result.current.grouped.projects[0].title).toBe("New name");
  });
});
