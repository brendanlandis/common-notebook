import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// HeaderContent depends on navigation + three contexts; stub them so the test
// stays focused on the header's own markup (the add-item tooltip copy).
vi.mock("next/navigation", () => ({
  usePathname: () => "/todo",
}));
vi.mock("@/app/contexts/ViewsContext", () => ({
  useViews: () => ({ views: [{ slug: "good-morning" }], loading: false }),
}));
vi.mock("@/app/contexts/StuffProjectsContext", () => ({
  useStuffProjects: () => ({ stuffProjectsEnabled: false }),
}));
vi.mock("@/app/contexts/PracticeContext", () => ({
  usePractice: () => ({ selectedPracticeType: "guitar", setSelectedPracticeType: vi.fn() }),
}));
vi.mock("@/app/contexts/TaskActionsContext", () => ({
  useTaskActions: () => ({ openTaskForm: vi.fn(), openProjectForm: vi.fn() }),
}));
vi.mock("@/app/(main)/todo/components/LayoutSelector", () => ({ default: () => null }));
vi.mock("@/app/components/MoonPhaseIcon", () => ({ default: () => null }));
vi.mock("@phosphor-icons/react", () => ({
  PlusCircleIcon: () => null,
  FolderSimplePlusIcon: () => null,
}));

import HeaderContent from "./HeaderContent";

describe("HeaderContent copy (todo→task rename)", () => {
  it('labels the add-item button tooltip "add task" on the /todo route', () => {
    const { container } = render(<HeaderContent />);
    // The tooltip copy lives in `data-tip` (a daisyUI attribute, not the a11y name).
    expect(container.querySelector('[data-tip="add task"]')).toBeTruthy();
    expect(container.querySelector('[data-tip="add todo"]')).toBeNull();
  });
});
