import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MainMenu from "@/app/components/chrome/MainMenu";

// Isolate the panel-switch logic: the real children pull in query hooks and a
// network fetch, none of which this test cares about. Stubs expose just the
// interaction points (the gear's onOpenSettings, and a settings marker).
vi.mock("@/app/components/chrome/MenuItems", () => ({
  default: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <button onClick={onOpenSettings}>open-settings</button>
  ),
}));
vi.mock("@/app/components/settings/SettingsPanel", () => ({
  default: () => <div>settings-panel</div>,
}));
vi.mock("@/app/components/chrome/HeaderIcon", () => ({ default: () => null }));

const openMenu = () => fireEvent.click(screen.getByLabelText("open menu"));

describe("MainMenu", () => {
  it("starts on the menu", () => {
    render(<MainMenu />);
    openMenu();
    expect(screen.getByText("open-settings")).toBeInTheDocument();
    expect(screen.queryByText("settings-panel")).not.toBeInTheDocument();
  });

  it("pushes the settings panel when the gear is clicked, and back returns", () => {
    render(<MainMenu />);
    openMenu();

    fireEvent.click(screen.getByText("open-settings"));
    expect(screen.getByText("settings-panel")).toBeInTheDocument();
    expect(screen.queryByText("open-settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("back"));
    expect(screen.getByText("open-settings")).toBeInTheDocument();
    expect(screen.queryByText("settings-panel")).not.toBeInTheDocument();
  });

  it("reopens on the menu after closing on settings", () => {
    render(<MainMenu />);
    openMenu();
    fireEvent.click(screen.getByText("open-settings"));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByText("settings-panel")).not.toBeInTheDocument();

    openMenu();
    expect(screen.getByText("open-settings")).toBeInTheDocument();
  });
});
