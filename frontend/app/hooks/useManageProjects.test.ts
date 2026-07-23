import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useManageProjects } from "./useManageProjects";

// Per-test client, retry:false so failure paths don't sit through a backoff.
function setup(search = "") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const { result } = renderHook(() => useManageProjects(search), { wrapper });
  return { result, invalidateSpy };
}

function fetchCalls() {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ success: true, data: [], page: 1, hasMore: false }),
  })) as unknown as typeof fetch;
});

describe("useManageProjects mutations", () => {
  it("completeProject PUTs {complete:true} and invalidates both roots", async () => {
    const { result, invalidateSpy } = setup();
    await act(async () => {
      await result.current.completeProject("p1");
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/projects/p1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ complete: true }) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tasks"] });
  });

  it("reviveProject PUTs {complete:false}", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.reviveProject("p1");
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/projects/p1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ complete: false }) })
    );
  });

  it("setImportance PUTs the new tier", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.setImportance("p1", "top of mind");
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/projects/p1",
      expect.objectContaining({ body: JSON.stringify({ importance: "top of mind" }) })
    );
  });
});

describe("useManageProjects completed query", () => {
  it("fetches completed projects on mount (section 4 is shown by default)", async () => {
    setup();
    await waitFor(() =>
      expect(fetchCalls().some((u) => u.includes("/api/projects/completed"))).toBe(true)
    );
  });

  it("passes the search term as ?q=", async () => {
    setup("mix");
    await waitFor(() =>
      expect(fetchCalls().some((u) => u.includes("q=mix"))).toBe(true)
    );
  });
});
