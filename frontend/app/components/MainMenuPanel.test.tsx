import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MainMenuPanel from "./MainMenuPanel";

// Isolate the panel-switch logic: the real children pull in query hooks and a
// network fetch, none of which this test cares about. Stubs expose just the
// interaction points (the gear's onOpenSettings, and a settings marker).
vi.mock("./MenuItems", () => ({
  default: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <button onClick={onOpenSettings}>open-settings</button>
  ),
}));
vi.mock("./SettingsPanel", () => ({
  default: () => <div>settings-panel</div>,
}));

describe("MainMenuPanel", () => {
  beforeEach(() => {
    // MainMenuPanel listens to this drawer checkbox to reset on close.
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "mainMenu";
    cb.checked = true;
    document.body.appendChild(cb);
  });

  afterEach(() => {
    document.getElementById("mainMenu")?.remove();
  });

  it("starts on the menu", () => {
    render(<MainMenuPanel />);
    expect(screen.getByText("open-settings")).toBeInTheDocument();
    expect(screen.queryByText("settings-panel")).not.toBeInTheDocument();
  });

  it("pushes the settings panel when the gear is clicked, and back returns", () => {
    render(<MainMenuPanel />);

    fireEvent.click(screen.getByText("open-settings"));
    expect(screen.getByText("settings-panel")).toBeInTheDocument();
    expect(screen.queryByText("open-settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("back"));
    expect(screen.getByText("open-settings")).toBeInTheDocument();
    expect(screen.queryByText("settings-panel")).not.toBeInTheDocument();
  });

  it("resets to the menu when the drawer closes", () => {
    render(<MainMenuPanel />);
    fireEvent.click(screen.getByText("open-settings"));
    expect(screen.getByText("settings-panel")).toBeInTheDocument();

    const cb = document.getElementById("mainMenu") as HTMLInputElement;
    cb.checked = false;
    fireEvent.change(cb);

    expect(screen.getByText("open-settings")).toBeInTheDocument();
    expect(screen.queryByText("settings-panel")).not.toBeInTheDocument();
  });
});
