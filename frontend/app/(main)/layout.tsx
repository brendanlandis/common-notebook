import MainMenuPanel from "../components/MainMenuPanel";
import HeaderContent from "../components/HeaderContent";
import TaskActionsDrawer from "../components/TaskActionsDrawer";
import { PracticeContextProvider } from "../contexts/PracticeContext";
import { TaskActionsProvider } from "../contexts/TaskActionsContext";
import { DateTimeSettingsProvider } from "../contexts/DateTimeSettingsContext";
import { StuffProjectsProvider } from "../contexts/StuffProjectsContext";
import QueryProvider from "../providers/QueryProvider";
import HeaderIcon from "../components/HeaderIcon";
import EscapeKeyHandler from "../components/EscapeKeyHandler";
import SessionGuard from "../components/SessionGuard";
import BetaGuard from "../components/BetaGuard";
import { getAccessTokenServer } from "@/app/lib/strapiAuth";
import {
  getCompletedTaskVisibilityMinutes,
  getTimeZoneSettings,
} from "@/app/lib/strapiServer";

/**
 * Resolve the owner's date/time settings here, on the server, so every client date
 * renders in their timezone on the first paint. The same `getTimeZoneSettings` backs
 * the API routes, which is what makes the setting a single source of truth rather
 * than two copies that drift.
 *
 * A null token means `getAccessTokenServer()` could not tell (a stale token it
 * won't refresh from a Server Component — see `page.tsx`). Pass null through and
 * let the provider resolve it client-side rather than pinning the session to the
 * defaults.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getAccessTokenServer();
  const dateTimeSettings = token
    ? await Promise.all([
        getTimeZoneSettings(token),
        getCompletedTaskVisibilityMinutes(token),
      ]).then(([timeZoneSettings, completedTaskVisibilityMinutes]) => ({
        timeZoneSettings,
        completedTaskVisibilityMinutes,
      }))
    : null;

  return (
    <QueryProvider>
      <DateTimeSettingsProvider initial={dateTimeSettings}>
        <StuffProjectsProvider>
          <PracticeContextProvider>
            <TaskActionsProvider>
            <SessionGuard />
            <EscapeKeyHandler />
            <div className="drawer">
            <input
              id="taskActionsDrawer"
              type="checkbox"
              className="drawer-toggle"
            />
            <div className="drawer-content">
              <div className="drawer">
                <input
                  id="mainMenu"
                  type="checkbox"
                  className="drawer-toggle"
                />
                <div className="drawer-content">
                  <header>
                    <div>
                      <label
                        htmlFor="mainMenu"
                        aria-label="open menu"
                        className="header-icon drawer-button"
                      >
                        <HeaderIcon />
                      </label>
                      <HeaderContent />
                    </div>
                  </header>
                  <main className="container" id="main-container">
                    <BetaGuard>{children}</BetaGuard>
                  </main>
                  <footer></footer>
                </div>
                <MainMenuPanel />
              </div>
            </div>
            <TaskActionsDrawer />
          </div>
            </TaskActionsProvider>
          </PracticeContextProvider>
        </StuffProjectsProvider>
      </DateTimeSettingsProvider>
    </QueryProvider>
  );
}
