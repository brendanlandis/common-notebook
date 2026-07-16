import { ListIcon } from "@phosphor-icons/react/dist/ssr";
import MenuItems from "../components/MenuItems";
import HeaderContent from "../components/HeaderContent";
import TaskActionsDrawer from "../components/TaskActionsDrawer";
import { PracticeContextProvider } from "../contexts/PracticeContext";
import { TaskActionsProvider } from "../contexts/TaskActionsContext";
import { TimezoneProvider } from "../contexts/TimezoneContext";
import { StuffProjectsProvider } from "../contexts/StuffProjectsContext";
import { WorldsProvider } from "../contexts/WorldsContext";
import { ViewsProvider } from "../contexts/ViewsContext";
import HeaderIcon from "../components/HeaderIcon";
import EscapeKeyHandler from "../components/EscapeKeyHandler";
import SessionGuard from "../components/SessionGuard";
import { BetaAccessProvider } from "../contexts/BetaAccessContext";
import BetaGuard from "../components/BetaGuard";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BetaAccessProvider>
    <TimezoneProvider>
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
    </TimezoneProvider>
    </BetaAccessProvider>
  );
}
