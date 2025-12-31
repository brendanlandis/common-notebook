import type { Metadata } from "next";
import localFont from "next/font/local";
import "./css/screen.css";
import ThemeToggle from "./components/ThemeToggle";
import { ListIcon } from "@phosphor-icons/react/dist/ssr";
import MenuClose from "./components/MenuClose";
import LogoutButton from "./components/admin/LogoutButton";
import MenuItems from "./components/MenuItems";
import HeaderContent from "./components/admin/HeaderContent";
import TodoActionsDrawer from "./components/admin/TodoActionsDrawer";
import { LayoutRulesetProvider } from "./contexts/LayoutRulesetContext";
import { PracticeContextProvider } from "./contexts/PracticeContext";
import { TodoActionsProvider } from "./contexts/TodoActionsContext";
import FaviconManager from "./components/FaviconManager";
import AdminHeaderIcon from "./components/admin/AdminHeaderIcon";
import EscapeKeyHandler from "./components/admin/EscapeKeyHandler";
import TimezoneManager from "./components/admin/TimezoneManager";
import { TimezoneProvider } from "./contexts/TimezoneContext";

export const metadata: Metadata = {
  title: "good enough notebook",
  description: "minimal, no-brand personal utilities",
};
const fontClash = localFont({
  src: "./fonts/ClashGrotesk.woff2",
  variable: "--font-clash",
});
const fontChillax = localFont({
  src: "./fonts/Chillax.woff2",
  variable: "--font-chillax",
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="Notebook" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const THEME_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours
                  const savedThemeData = localStorage.getItem('theme');
                  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  let themeToApply = systemPrefersDark ? 'dark' : 'light';

                  if (savedThemeData) {
                    try {
                      const { theme, timestamp } = JSON.parse(savedThemeData);
                      const now = Date.now();
                      if (now - timestamp < THEME_EXPIRY_MS) {
                        themeToApply = theme;
                      } else {
                        localStorage.removeItem('theme');
                      }
                    } catch (e) {
                      localStorage.removeItem('theme');
                    }
                  }

                  document.documentElement.setAttribute(
                    'data-theme',
                    themeToApply === 'dark' ? 'dim' : 'retro'
                  );
                } catch (e) {
                  // Fail silently
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`
          ${fontClash.variable}
          ${fontChillax.variable}
        `}
      >
        <FaviconManager type="bird" />
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
                          <TimezoneManager />
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
        </TimezoneProvider>
      </body>
    </html>
  );
}
