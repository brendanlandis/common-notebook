import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Task } from "@/app/types/index";

/**
 * The piece form's contract is the payload: a piece's place (rotation, shelf,
 * on hold, learned) is three task flags, and moving it must set all three so no
 * stale flag survives the move.
 */

const practice = { id: 1, documentId: "w-practice", title: "practice and study", slug: "p", position: 0, systemKey: "practice" };
const chores = { id: 2, documentId: "w-chores", title: "chores", slug: "c", position: 1, systemKey: null };

vi.mock("@/app/hooks/useProjects", () => ({
  useProjects: () => ({
    projects: [
      { documentId: "guitar", title: "guitar", world: practice },
      { documentId: "ear", title: "ear training", world: practice },
      { documentId: "house", title: "house", world: chores },
    ],
  }),
}));
vi.mock("@/app/(main)/(todo)/hooks/useTasks", () => ({
  useTasks: () => ({
    tasks: [
      { documentId: "a", project: { documentId: "guitar" }, materialCategory: "scales" },
      { documentId: "b", project: { documentId: "guitar" }, materialCategory: "songs" },
      { documentId: "c", project: { documentId: "ear" }, materialCategory: "intervals" },
    ],
  }),
}));
vi.mock("@/app/components/ui/RichTextEditor", () => ({ default: () => null }));

import PieceForm, { placeOf, flagsFor } from "./PieceForm";

const piece = (over: Partial<Task> = {}) =>
  ({
    documentId: "reversal",
    title: "Receive - Reversal",
    project: { documentId: "guitar" },
    materialCategory: "songs",
    description: [],
    soon: true,
    onHold: false,
    completed: false,
    completedAt: null,
    ...over,
  }) as unknown as Task;

describe("placeOf", () => {
  it("reads the four places from the flags, learned and on hold first", () => {
    expect(placeOf({ soon: true, onHold: false, completed: false })).toBe("rotation");
    expect(placeOf({ soon: false, onHold: false, completed: false })).toBe("shelf");
    expect(placeOf({ soon: true, onHold: true, completed: false })).toBe("hold");
    expect(placeOf({ soon: true, onHold: true, completed: true })).toBe("learned");
  });
});

describe("flagsFor", () => {
  it("writes all three flags for every place", () => {
    expect(flagsFor("rotation")).toMatchObject({ soon: true, onHold: false, completed: false, completedAt: null });
    expect(flagsFor("shelf")).toMatchObject({ soon: false, onHold: false, completed: false });
    expect(flagsFor("hold")).toMatchObject({ soon: false, onHold: true, completed: false });
    expect(flagsFor("learned")).toMatchObject({ soon: false, onHold: false, completed: true });
  });

  it("keeps the first learned date while a piece stays learned", () => {
    const current = { completed: true, completedAt: "2026-09-12T12:00:00.000Z" };
    expect(flagsFor("learned", current).completedAt).toBe("2026-09-12T12:00:00.000Z");
  });
});

describe("PieceForm", () => {
  it("offers only practice subjects", () => {
    render(<PieceForm onSubmit={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["ear training", "guitar"]);
  });

  it("moves a piece from rotation to learned", () => {
    const onSubmit = vi.fn();
    render(<PieceForm piece={piece()} onSubmit={onSubmit} onDelete={vi.fn()} />);
    expect((screen.getByLabelText("in rotation") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByLabelText("learned"));
    fireEvent.click(screen.getByRole("button", { name: "update piece" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Receive - Reversal",
        project: "guitar",
        materialCategory: "songs",
        soon: false,
        onHold: false,
        completed: true,
      }),
    );
  });

  it("starts a new piece in rotation under the subject it was opened for", () => {
    const onSubmit = vi.fn();
    render(<PieceForm subjectId="ear" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "chord quality" } });
    fireEvent.click(screen.getByRole("button", { name: "create piece" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "chord quality", project: "ear", soon: true, completed: false }),
    );
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
  });

  it("suggests the categories already used under the chosen subject only", () => {
    render(<PieceForm piece={piece({ materialCategory: null } as Partial<Task>)} onSubmit={vi.fn()} />);
    fireEvent.focus(screen.getByLabelText("category"));
    expect(screen.getByText("scales")).toBeTruthy();
    expect(screen.getByText("songs")).toBeTruthy();
    expect(screen.queryByText("intervals")).toBeNull();
  });

  it("won't save a piece with no name", () => {
    const onSubmit = vi.fn();
    render(<PieceForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "create piece" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("a piece needs a name")).toBeTruthy();
  });

  it("saves the tempo and link, and a blank tempo as none", () => {
    const onSubmit = vi.fn();
    render(
      <PieceForm
        piece={piece({ tempo: 140, goalTempo: 160 } as Partial<Task>)}
        onSubmit={onSubmit}
        onDelete={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("at") as HTMLInputElement).value).toBe("140");

    fireEvent.change(screen.getByLabelText("at"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("goal"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("link"), { target: { value: "https://example.com/tab" } });
    fireEvent.click(screen.getByRole("button", { name: "update piece" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tempo: 150, goalTempo: null, link: "https://example.com/tab" }),
    );
  });
});
