import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const openManageProjects = vi.fn();
const openWorlds = vi.fn();
const openViews = vi.fn();

// HeaderContent depends on navigation + three contexts; stub them so the test
// stays focused on the header's own markup (the add-item tooltip copy).
vi.mock("next/navigation", () => ({
  usePathname: () => "/todo",
}));
vi.mock("@/app/hooks/useViews", () => ({
  useViews: () => ({ views: [{ slug: "good-morning" }], loading: false }),
}));
vi.mock("@/app/contexts/StuffProjectsContext", () => ({
  useStuffProjects: () => ({ stuffProjectsEnabled: false }),
}));
vi.mock("@/app/contexts/PracticeContext", () => ({
  usePractice: () => ({ selectedPracticeType: "guitar", setSelectedPracticeType: vi.fn() }),
}));
vi.mock("@/app/contexts/TaskActionsContext", () => ({
  useTaskActions: () => ({
    openTaskForm: vi.fn(),
    openProjectForm: vi.fn(),
    openManageProjects,
    openWorlds,
    openViews,
  }),
}));
vi.mock("@/app/(main)/todo/components/LayoutSelector", () => ({ default: () => null }));
vi.mock("@/app/components/MoonPhaseIcon", () => ({ default: () => null }));
vi.mock("@phosphor-icons/react", () => ({
  PlusCircleIcon: () => null,
  FolderSimplePlusIcon: () => null,
  FoldersIcon: () => null,
  PlanetIcon: () => null,
  SquaresFourIcon: () => null,
  CaretLeftIcon: () => null,
  CaretRightIcon: () => null,
}));

import HeaderContent from "./HeaderContent";

// The moon-phase reset is a mutation now (it used to be a raw fetch plus a
// CustomEvent), so the component calls useQueryClient and needs a provider even
// though this test never triggers it. Per-test client, retry: false.
const renderHeader = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HeaderContent />
    </QueryClientProvider>
  );
};

describe("HeaderContent copy (todo→task rename)", () => {
  it('labels the add-item button tooltip "add task" on the /todo route', () => {
    const { container } = renderHeader();
    // The tooltip copy lives in `data-tip` (a daisyUI attribute, not the a11y name).
    expect(container.querySelector('[data-tip="add task"]')).toBeTruthy();
    expect(container.querySelector('[data-tip="add todo"]')).toBeNull();
  });
});

describe("HeaderContent manage-buttons disclosure", () => {
  beforeEach(() => {
    openManageProjects.mockClear();
  });

  it("hides the manage cluster (worlds/views/manage projects) until hovered", () => {
    const { container } = renderHeader();
    // Everyday actions are always present…
    expect(container.querySelector('[data-tip="add task"]')).toBeTruthy();
    expect(container.querySelector('[data-tip="declutter"]')).toBeTruthy();
    // …but the config cluster is hidden until the caret is hovered. The caret has
    // no tooltip (data-tip); it's the .manage-cluster's only child when collapsed.
    expect(container.querySelector('[data-tip="manage projects"]')).toBeNull();
    expect(container.querySelector('[data-tip="manage worlds"]')).toBeNull();
    expect(container.querySelector(".manage-caret")).toBeTruthy();
  });

  it("reveals and wires the manage-projects button on hover", () => {
    const { container } = renderHeader();
    fireEvent.mouseEnter(container.querySelector(".manage-cluster")!);
    const manageBtn = container.querySelector('[data-tip="manage projects"]');
    expect(manageBtn).toBeTruthy();
    expect(container.querySelector('[data-tip="manage worlds"]')).toBeTruthy();
    fireEvent.click(manageBtn!);
    expect(openManageProjects).toHaveBeenCalledTimes(1);
    // Leaving collapses it again.
    fireEvent.mouseLeave(container.querySelector(".manage-cluster")!);
    expect(container.querySelector('[data-tip="manage projects"]')).toBeNull();
  });
});
