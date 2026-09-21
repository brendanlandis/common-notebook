import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const openManageProjects = vi.fn();
const openWorlds = vi.fn();
const openViews = vi.fn();

// HeaderContent depends on navigation + three contexts; stub them so the test
// stays focused on the header's own markup (the add-item tooltip copy).
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
vi.mock("@/app/(main)/(todo)/hooks/useViews", () => ({
  useViews: () => ({ views: [{ slug: "good-morning" }], loading: false }),
}));
vi.mock("@/app/(main)/(todo)/contexts/StuffProjectsContext", () => ({
  useStuffProjects: () => ({ stuffProjectsEnabled: false }),
}));
vi.mock("@/app/(main)/(todo)/contexts/TaskActionsContext", () => ({
  useTaskActions: () => ({
    openTaskForm: vi.fn(),
    openProjectForm: vi.fn(),
    openManageProjects,
    openWorlds,
    openViews,
  }),
}));
vi.mock("@/app/(main)/(todo)/components/LayoutSelector", () => ({ default: () => null }));
vi.mock("@/app/components/chrome/MoonPhaseIcon", () => ({ default: () => null }));
vi.mock("@phosphor-icons/react", () => ({
  PlusCircleIcon: () => null,
  FolderSimplePlusIcon: () => null,
  FoldersIcon: () => null,
  PlanetIcon: () => null,
  SquaresFourIcon: () => null,
  CaretRightIcon: () => null,
}));

import HeaderContent from "@/app/components/chrome/HeaderContent";

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
  it('labels the add-item button tooltip "add task" on a to-do route', () => {
    const { container } = renderHeader();
    // The tooltip copy lives in `data-tip` (a daisyUI attribute, not the a11y name).
    expect(container.querySelector('[data-tip="add task"]')).toBeTruthy();
    expect(container.querySelector('[data-tip="add todo"]')).toBeNull();
  });
});

describe("HeaderContent manage-buttons disclosure", () => {
  /**
   * Two ways in, because there are two kinds of device.
   *
   * This cluster was hover-and-focus only, which is no way in on a touch screen.
   * It looked fine on iOS purely because WebKit focuses a button when you tap
   * it; Chrome on Android doesn't, so manage projects, manage worlds and manage
   * views were unreachable on that phone entirely. Nothing in a desktop-only
   * test suite could say so — hence the `(hover: none)` cases below, and the
   * Android project in the Playwright config.
   */
  const withHover = (hover: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("hover: hover") ? hover : !hover,
      })) as unknown as typeof window.matchMedia
    );

  beforeEach(() => {
    openManageProjects.mockClear();
    withHover(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The cluster stays mounted so it can slide shut: closed means inert, not gone. */
  const reachable = (container: HTMLElement, tip: string) => {
    const button = container.querySelector(`[data-tip="${tip}"]`);
    return button !== null && button.closest("[inert]") === null;
  };

  it("hides the manage cluster (worlds/views/manage projects) until asked for", () => {
    const { container } = renderHeader();
    // Everyday actions are always present…
    expect(container.querySelector('[data-tip="add task"]')).toBeTruthy();
    expect(container.querySelector('[data-tip="declutter"]')).toBeTruthy();
    // …but the config cluster is out of reach until the caret is hovered or
    // pressed. The caret has no tooltip (data-tip).
    expect(reachable(container, "manage projects")).toBe(false);
    expect(reachable(container, "manage worlds")).toBe(false);
    expect(container.querySelector('[aria-label="more buttons"]')).toBeTruthy();
  });

  it("reveals and wires the manage-projects button on hover", () => {
    const { container } = renderHeader();
    fireEvent.pointerEnter(container.querySelector('[aria-label="more buttons"]')!.parentElement!);
    expect(reachable(container, "manage projects")).toBe(true);
    expect(reachable(container, "manage worlds")).toBe(true);
    fireEvent.click(container.querySelector('[data-tip="manage projects"]')!);
    expect(openManageProjects).toHaveBeenCalledTimes(1);
    // Leaving collapses it again.
    fireEvent.pointerLeave(container.querySelector('[aria-label="more buttons"]')!.parentElement!);
    expect(reachable(container, "manage projects")).toBe(false);
  });

  it("opens on a press, which is how a phone and a keyboard both get in", () => {
    withHover(false);
    const { container } = renderHeader();
    const caret = container.querySelector('[aria-label="more buttons"]')!;

    expect(caret.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(caret);

    expect(caret.getAttribute("aria-expanded")).toBe("true");
    expect(reachable(container, "manage views")).toBe(true);
  });

  it("closes again on a second press", () => {
    withHover(false);
    const { container } = renderHeader();
    const caret = container.querySelector('[aria-label="more buttons"]')!;

    fireEvent.click(caret);
    fireEvent.click(caret);

    expect(caret.getAttribute("aria-expanded")).toBe("false");
    expect(reachable(container, "manage views")).toBe(false);
  });

  it("ignores hover entirely on a device that cannot hover", () => {
    // The bug this replaced was subtler than "no handler": a `pointerType`
    // guard still let a phone's synthetic mouse events open the cluster and
    // then close it mid-press, so the button unmounted before the click landed
    // and nothing happened at all.
    withHover(false);
    const { container } = renderHeader();
    const cluster = container.querySelector('[aria-label="more buttons"]')!.parentElement!;

    fireEvent.pointerEnter(cluster);
    expect(reachable(container, "manage views")).toBe(false);

    fireEvent.click(container.querySelector('[aria-label="more buttons"]')!);
    expect(reachable(container, "manage views")).toBe(true);

    // And a stray pointerleave must not snatch it away again.
    fireEvent.pointerLeave(cluster);
    expect(reachable(container, "manage views")).toBe(true);
  });
});
