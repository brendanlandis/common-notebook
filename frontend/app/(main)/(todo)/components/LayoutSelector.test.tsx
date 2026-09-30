import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LayoutSelector from "./LayoutSelector";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(main)/(todo)/contexts/StuffProjectsContext", () => ({
  useStuffProjects: () => ({ stuffProjectsEnabled: true }),
}));
vi.mock("@/app/(main)/(todo)/hooks/useViews", () => ({ useViews: () => ({ views: [] }) }));
vi.mock("@/app/(main)/(todo)/hooks/useWorlds", () => ({
  useWorlds: () => ({
    worlds: [
      { id: 1, documentId: "w1", title: "practice and study", slug: "practice-and-study", position: 0, systemKey: "practice" },
      { id: 2, documentId: "w2", title: "stuff", slug: "stuff", position: 1, systemKey: "stuff" },
      { id: 3, documentId: "w3", title: "music", slug: "music", position: 2, systemKey: null },
    ],
  }),
}));

describe("LayoutSelector — world options", () => {
  it("lists ordinary worlds but not stuff or practice and study", () => {
    render(<LayoutSelector value="world:music" />);
    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels).toContain("music");
    expect(labels).not.toContain("stuff");
    expect(labels).not.toContain("practice and study");
  });
});
