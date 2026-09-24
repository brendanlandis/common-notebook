import MainMenu from "@/app/components/chrome/MainMenu";
import HeaderContent from "@/app/components/chrome/HeaderContent";
import { PracticeSessionProvider } from "../contexts/PracticeSessionContext";
import PracticeSessionModal from "@/app/(main)/practice/components/PracticeSessionModal";
import { TaskActionsProvider } from "@/app/(main)/(todo)/contexts/TaskActionsContext";
import { DateTimeSettingsProvider } from "../contexts/DateTimeSettingsContext";
import { StuffProjectsProvider } from "@/app/(main)/(todo)/contexts/StuffProjectsContext";
import QueryProvider from "../providers/QueryProvider";
import SessionGuard from "@/app/components/chrome/SessionGuard";
import BetaGuard from "@/app/components/chrome/BetaGuard";
import { getAccessTokenServer } from "@/app/lib/strapiAuth";
import { SessionEndedError } from "@/app/lib/authErrors";
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
 * defaults. The same when Strapi refuses the token (a blocked or deleted user):
 * the client's first request then gets the 401 that ends the session and clears
 * the cookies, which a Server Component can't do.
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
      ])
        .then(([timeZoneSettings, completedTaskVisibilityMinutes]) => ({
          timeZoneSettings,
          completedTaskVisibilityMinutes,
        }))
        .catch((error) => {
          if (error instanceof SessionEndedError) return null;
          throw error;
        })
    : null;

  return (
    <QueryProvider>
      <DateTimeSettingsProvider initial={dateTimeSettings}>
        <StuffProjectsProvider>
            <PracticeSessionProvider>
            <TaskActionsProvider>
            <SessionGuard />
            {/* Last-rendered dialog wins, and this one sits above the drawers
                too, so a running session covers the header, the menu and
                whatever page is open. That it cannot be navigated away from is
                the feature. */}
            <PracticeSessionModal />
            {/* Clipped sideways only. A hidden tooltip is still laid out, and
                one under a button near the right edge made the page wider
                than the window while the manage buttons were out. */}
            <header className="grid grid-cols-1 items-start overflow-x-clip px-4 pt-4">
              {/* Wraps, because on a phone this row is wider than the
                  screen. Without wrapping, the manage cluster's buttons
                  extended past the right edge of a 393px viewport, present
                  in the DOM and impossible to touch. */}
              <div className="flex flex-wrap items-center gap-3 justify-self-start">
                <MainMenu />
                <HeaderContent />
              </div>
            </header>
            <main
              className="w-full max-w-screen overflow-hidden px-4 pt-8 min-[1600px]:max-w-[1600px]"
              id="main-container"
            >
              <BetaGuard>{children}</BetaGuard>
            </main>
            <footer></footer>
            </TaskActionsProvider>
            </PracticeSessionProvider>
        </StuffProjectsProvider>
      </DateTimeSettingsProvider>
    </QueryProvider>
  );
}
