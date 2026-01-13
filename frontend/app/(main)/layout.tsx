import { ListIcon } from "@phosphor-icons/react/dist/ssr";
import MenuItems from "../components/MenuItems";
import HeaderContent from "../components/HeaderContent";
import TodoActionsDrawer from "../components/TodoActionsDrawer";
import { LayoutRulesetProvider } from "../contexts/LayoutRulesetContext";
import { PracticeContextProvider } from "../contexts/PracticeContext";
import { TodoActionsProvider } from "../contexts/TodoActionsContext";
import { TimezoneProvider } from "../contexts/TimezoneContext";
import HeaderIcon from "../components/HeaderIcon";
import EscapeKeyHandler from "../components/EscapeKeyHandler";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TimezoneProvider>
      <LayoutRulesetProvider>
        <PracticeContextProvider>
          <TodoActionsProvider>
            <EscapeKeyHandler />
            <div className="drawer">
            <input
              id="todoActionsDrawer"
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
                    {children}
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
            <TodoActionsDrawer />
          </div>
        </TodoActionsProvider>
      </PracticeContextProvider>
    </LayoutRulesetProvider>
    </TimezoneProvider>
  );
}
