import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { World } from "@/app/types/index";

/**
 * The subject-type dropdown, and the one rule underneath it: `projectType` is a
 * single Strapi column serving three different questions, so the form must send
 * exactly one answer and never offer two.
 */

const worlds: World[] = [
  { documentId: "w-life", title: "life stuff", slug: "life-stuff", systemKey: null } as World,
  {
    documentId: "w-practice",
    title: "practice and study",
    slug: "practice-and-study",
    systemKey: "practice",
  } as World,
];

vi.mock("@/app/hooks/useWorlds", () => ({ useWorlds: () => ({ worlds }) }));
vi.mock("@/app/components/RichTextEditor", () => ({ default: () => null }));

import ProjectForm from "./ProjectForm";

let onSubmit: ReturnType<typeof vi.fn>;

function renderForm(project?: Parameters<typeof ProjectForm>[0]["project"]) {
  onSubmit = vi.fn();
  render(<ProjectForm project={project} onSubmit={onSubmit} onCancel={vi.fn()} />);
}

const chooseWorld = (documentId: string) =>
  fireEvent.change(screen.getByLabelText("world"), { target: { value: documentId } });

const submit = () =>
  fireEvent.submit(screen.getByRole("button", { name: /project$/ }).closest("form")!);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("outside practice and study", () => {
  it("offers chores and no subject type", () => {
    renderForm();
    chooseWorld("w-life");

    expect(screen.getByLabelText("chores")).toBeDefined();
    expect(screen.queryByLabelText("kind of subject")).toBeNull();
  });

  it("sends default for an ordinary project", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("title"), { target: { value: "errands" } });
    chooseWorld("w-life");
    submit();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectType: "default" }))
    );
  });
});

describe("in practice and study", () => {
  it("reveals the subject type as soon as the world is chosen", () => {
    // The two questions are really one — filing a project there is what makes
    // "instrument or study?" worth asking, so it must not wait for a save.
    renderForm();
    expect(screen.queryByLabelText("kind of subject")).toBeNull();

    chooseWorld("w-practice");
    expect(screen.getByLabelText("kind of subject")).toBeDefined();
  });

  it("hides the chores checkbox, which shares the same column", () => {
    // Offering both would let you tick a box the save then silently discards.
    renderForm();
    chooseWorld("w-practice");
    expect(screen.queryByLabelText("chores")).toBeNull();
  });

  it("defaults to instrument", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("title"), { target: { value: "guitar" } });
    chooseWorld("w-practice");
    submit();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectType: "instrument" }))
    );
  });

  it("sends study when chosen", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("title"), { target: { value: "german" } });
    chooseWorld("w-practice");
    fireEvent.change(screen.getByLabelText("kind of subject"), {
      target: { value: "study" },
    });
    submit();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectType: "study" }))
    );
  });

  it("seeds the dropdown from an existing subject", () => {
    renderForm({
      documentId: "p-1",
      title: "german",
      description: [],
      projectType: "study",
      world: worlds[1],
    } as Parameters<typeof ProjectForm>[0]["project"]);

    expect((screen.getByLabelText("kind of subject") as HTMLSelectElement).value).toBe("study");
  });

  it("moving a subject out of the world reverts it to an ordinary project", async () => {
    // `instrument` outside practice and study would be a project type nothing
    // reads, on a project nothing treats as a subject.
    renderForm({
      documentId: "p-1",
      title: "guitar",
      description: [],
      projectType: "instrument",
      world: worlds[1],
    } as Parameters<typeof ProjectForm>[0]["project"]);

    chooseWorld("w-life");
    submit();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectType: "default" }))
    );
  });
});
