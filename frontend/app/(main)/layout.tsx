import { ListIcon, GearIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import MenuClose from "../components/MenuClose";
import LogoutButton from "../components/admin/LogoutButton";
import MenuItems from "../components/MenuItems";
import HeaderContent from "../components/admin/HeaderContent";
import TodoActionsDrawer from "../components/admin/TodoActionsDrawer";
import { LayoutRulesetProvider } from "../contexts/LayoutRulesetContext";
import { PracticeContextProvider } from "../contexts/PracticeContext";
import { TodoActionsProvider } from "../contexts/TodoActionsContext";
import AdminHeaderIcon from "../components/admin/AdminHeaderIcon";
import EscapeKeyHandler from "../components/admin/EscapeKeyHandler";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
                  id="adminMenu"
                  type="checkbox"
                  className="drawer-toggle"
                />
                <div className="drawer-content">
                  <header>
                    <div>
                      <HeaderContent />
                    </div>
                    <div>
                      <AdminHeaderIcon />
                    </div>
                    <div>
                      <label htmlFor="adminMenu" className="drawer-button">
                        <ListIcon size={40} weight="regular" />
                      </label>
                    </div>
                  </header>
                  <main className="container" id="admin-container">
                    {children}
                  </main>
                  <footer></footer>
                </div>
                <div className="drawer-side">
                  <label
                    htmlFor="adminMenu"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                  ></label>
                  <ul className="menu bg-base-200 text-base-content min-h-full w-auto p-4">
                    <li className="admin-menu-header">
                      <MenuClose />
                      <ThemeToggle />
                    </li>
                    <MenuItems />
                    <li>
                      <Link id="settings-link" href="/settings">
                        <GearIcon size={30} weight="thin" />
                        <span>settings</span>
                      </Link>
                    </li>
                    <li>
                      <LogoutButton />
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <TodoActionsDrawer />
          </div>
        </TodoActionsProvider>
      </PracticeContextProvider>
    </LayoutRulesetProvider>
  );
}

