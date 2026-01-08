import type { Metadata } from "next";
import localFont from "next/font/local";
import "./css/screen.css";
import { TimezoneProvider } from "./contexts/TimezoneContext";

export const metadata: Metadata = {
  title: "common notebook",
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

export default function RootLayout({
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
        <TimezoneProvider>
          {children}
        </TimezoneProvider>
      </body>
    </html>
  );
}
