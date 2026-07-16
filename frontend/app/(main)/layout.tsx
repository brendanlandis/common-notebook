import { ListIcon } from "@phosphor-icons/react/dist/ssr";
import MenuItems from "../components/MenuItems";
import HeaderContent from "../components/HeaderContent";
import TaskActionsDrawer from "../components/TaskActionsDrawer";
import { PracticeContextProvider } from "../contexts/PracticeContext";
import { TaskActionsProvider } from "../contexts/TaskActionsContext";
import { DateTimeSettingsProvider } from "../contexts/DateTimeSettingsContext";
import { StuffProjectsProvider } from "../contexts/StuffProjectsContext";
import { WorldsProvider } from "../contexts/WorldsContext";
import { ViewsProvider } from "../contexts/ViewsContext";
import HeaderIcon from "../components/HeaderIcon";
import EscapeKeyHandler from "../components/EscapeKeyHandler";
import SessionGuard from "../components/SessionGuard";
import { BetaAccessProvider } from "../contexts/BetaAccessContext";
import BetaGuard from "../components/BetaGuard";
import { getAccessTokenServer } from "@/app/lib/strapiAuth";
import { getTimeZoneSettings } from "@/app/lib/strapiServer";

/**
 * Resolve the owner's time settings here, on the server, so every client date
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
  const timeZoneSettings = token ? await getTimeZoneSettings(token) : null;

  return (
    <BetaAccessProvider>
    <DateTimeSettingsProvider initial={timeZoneSettings}>
      <WorldsProvider>
      <ViewsProvider>
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
              <div className="drawer drawer-end">
                <input
                  id="mainMenu"
                  type="checkbox"
                  className="drawer-toggle"
                />
                <div className="drawer-content">
                  <header>
                    <div>
                      <div className="header-icon">
                        <HeaderIcon />
                      </div>
                      <HeaderContent />
                    </div>
                    <div>
                      <label htmlFor="mainMenu" className="drawer-button">
                        <ListIcon size={40} weight="regular" />
                      </label>
                    </div>
                  </header>
                  <main className="container" id="main-container">
                    <BetaGuard>{children}</BetaGuard>
                  </main>
                  <footer></footer>
                </div>
                <div className="drawer-side">
                  <label
                    htmlFor="mainMenu"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                  ></label>
                  <ul className="menu bg-base-200 text-base-content min-h-full w-auto p-4">
                    <MenuItems />
                  </ul>
                </div>
              </div>
            </div>
            <TaskActionsDrawer />
          </div>
        </TaskActionsProvider>
      </PracticeContextProvider>
    </StuffProjectsProvider>
    </ViewsProvider>
    </WorldsProvider>
    </DateTimeSettingsProvider>
    </BetaAccessProvider>
  );
}
