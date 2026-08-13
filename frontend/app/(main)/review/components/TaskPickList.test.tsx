import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TaskPickList from "./TaskPickList";
import type { Task } from "@/app/types/index";

/**
 * The claim worth testing here isn't the layout, it's the **semantics**: these
 * are toggles, not checkboxes.
 *
 * A checkbox beside a task in this app means "done", and that is the one thing
 * this control never does. `aria-pressed` is what says so to anything that
 * isn't looking at the fill colour, so it's asserted rather than left to the
 * stylesheet.
 */

let seq = 0;
function task(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: seq,
    documentId: `t-${seq}`,
    title: `task ${seq}`,
    completed: false,
    ...overrides,
  } as Task;
}

describe("TaskPickList", () => {
  it("renders each task as a toggle, not a checkbox", () => {
    render(
      <TaskPickList
        tasks={[task({ documentId: "a", title: "write the thing" })]}
        selected={new Set()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: /write the thing/ }).getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("reports a picked task as pressed", () => {
    render(
      <TaskPickList
        tasks={[task({ documentId: "a", title: "chosen" })]}
        selected={new Set(["a"])}
        onToggle={vi.fn()}
      />
    );

    const pill = screen.getByRole("button", { name: /chosen/ });
    expect(pill.getAttribute("aria-pressed")).toBe("true");
    expect(pill.className).toContain("is-selected");
  });

  it("hands the documentId back on click", () => {
    const onToggle = vi.fn();
    render(
      <TaskPickList
        tasks={[task({ documentId: "a", title: "pick me" })]}
        selected={new Set()}
        onToggle={onToggle}
      />
    );

    screen.getByRole("button", { name: /pick me/ }).click();

    expect(onToggle).toHaveBeenCalledWith("a");
  });

  it("offers nothing to click when read-only", () => {
    // The daily page's reading view. A pill there invites a click that does
    // nothing.
    render(
      <TaskPickList
        tasks={[task({ documentId: "a", title: "today's thing" })]}
        selected={new Set()}
        onToggle={vi.fn()}
        readOnly
      />
    );

    expect(screen.getByText("today's thing")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the empty message only when given one", () => {
    const { container, rerender } = render(
      <TaskPickList tasks={[]} selected={new Set()} onToggle={vi.fn()} />
    );
    // The review page now hides the whole section instead, so an empty list with
    // no message must render nothing at all rather than an empty <ul>.
    expect(container.innerHTML).toBe("");

    rerender(
      <TaskPickList
        tasks={[]}
        selected={new Set()}
        onToggle={vi.fn()}
        emptyMessage="nothing here"
      />
    );
    expect(screen.getByText("nothing here")).toBeTruthy();
  });
});
