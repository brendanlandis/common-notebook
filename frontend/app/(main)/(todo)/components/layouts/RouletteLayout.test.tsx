import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import RouletteLayout from "./RouletteLayout";
import type { LayoutRendererProps } from "./types";

// Minimal props: the empty-state branch renders before any TaskItem, so only
// `transformedData.rouletteTasks` matters. Handlers are inert.
function props(rouletteTasks: unknown[]): LayoutRendererProps {
  return {
    transformedData: { rouletteTasks } as any,
    onComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onWorkSession: vi.fn(),
    onRemoveWorkSession: vi.fn(),
    onSkipRecurring: vi.fn(),
  } as unknown as LayoutRendererProps;
}

describe("RouletteLayout copy (todo→task rename)", () => {
  it('shows the "task" empty state when there are no tasks', () => {
    render(<RouletteLayout {...props([])} />);
    // getByText throws if the string is absent, so this asserts the new wording.
    expect(screen.getByText("No tasks available")).toBeTruthy();
    expect(screen.queryByText(/todo/i)).toBeNull();
  });
});
