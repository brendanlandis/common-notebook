import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseReviewCadence } from "@/app/lib/reviewCadence";

/**
 * The review cadence section is beta-gated, and this is the one place in the app
 * that calls `useBetaAccess` directly — pages gate through `BETA_PATHS`, but a
 * field inside a drawer every user opens can't. So the gate has no other test
 * covering it.
 */

const betaAccess = vi.fn();
const saveCadence = vi.fn();

vi.mock("@/app/hooks/useBetaAccess", () => ({
  useBetaAccess: () => ({ betaAccess: betaAccess(), loading: false }),
}));

vi.mock("@/app/hooks/useReviewCadence", () => ({
  useReviewCadence: () => ({
    cadence: parseReviewCadence(null),
    loading: false,
    save: saveCadence,
    saveError: null,
    isSaving: false,
  }),
}));

// Unrelated to the cadence and each pulls its own server state.
vi.mock("@/app/components/TimezoneManager", () => ({ default: () => null }));
vi.mock("@/app/lib/autoDeclutterConfig", () => ({
  fetchAutoDeclutterFromStrapi: async () => true,
  saveAutoDeclutterToStrapi: async () => true,
}));
vi.mock("@/app/lib/completedTaskVisibilityConfig", () => ({
  saveVisibilityMinutesToStrapi: async () => true,
  parseVisibilityMinutes: () => 15,
}));
vi.mock("@/app/lib/systemSettingsClient", () => ({
  saveSystemSetting: async () => true,
}));
vi.mock("@/app/contexts/DateTimeSettingsContext", () => ({
  useDateTimeSettings: () => ({
    timeZoneSettings: { timezone: "America/New_York", dayBoundaryHour: 4 },
    setTimeZoneSettings: vi.fn(),
    completedTaskVisibilityMinutes: 15,
    setCompletedTaskVisibilityMinutes: vi.fn(),
  }),
}));

import SettingsPanel from "./SettingsPanel";

function renderPanel() {
  // Per-test client with retry off — the app default of 1 would make any
  // failure sit through a backoff before the assertion runs.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPanel />
    </QueryClientProvider>
  );
}

describe("SettingsPanel review cadence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides the cadence section without beta access", async () => {
    betaAccess.mockReturnValue(false);
    renderPanel();

    // The rest of the panel still renders, so this is the gate and not a crash.
    await waitFor(() => expect(screen.getByText("day boundary")).toBeTruthy());
    expect(screen.queryByLabelText("recurrence type")).toBeNull();
  });

  it("shows the cadence section with beta access", async () => {
    betaAccess.mockReturnValue(true);
    renderPanel();

    await waitFor(() => expect(screen.getByLabelText("recurrence type")).toBeTruthy());
  });

  it("does not ask for a start date unless the cadence is biweekly", async () => {
    betaAccess.mockReturnValue(true);
    renderPanel();

    await waitFor(() => expect(screen.getByLabelText("recurrence type")).toBeTruthy());
    // Default cadence is weekly, whose phase comes from the weekday itself.
    expect(screen.queryByLabelText("starting on")).toBeNull();
    expect(screen.queryByText(/pick a start date/i)).toBeNull();
  });
});
