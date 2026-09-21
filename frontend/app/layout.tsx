import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Serif } from "next/font/google";
import "./css/screen.css";

export const metadata: Metadata = {
  title: "common notebook",
  description: "minimal, no-brand personal utilities",
};

/*
 * Sweetheart's own metrics claim 1.122em of height, but its letters run from
 * cap height (677 of 1000 units) to the lowercase descenders (-204), 0.881em.
 * These overrides make the em that span, so at line-height 1 a line's box sits
 * exactly on its letters. G and Y tails (-358) hang below it by design; the
 * headings' line spacing keeps them off the next line (see type.css).
 * Firefox multiplies the overrides by size-adjust, so they are the raw metrics.
 * Measured 2026-09-21 with fontTools and checked against Firefox's rendering.
 */
const fontSweetheart = localFont({
  src: "./fonts/Sweetheart.woff2",
  variable: "--font-sweetheart",
  declarations: [
    { prop: "size-adjust", value: "113.56%" },
    { prop: "ascent-override", value: "67.7%" },
    { prop: "descent-override", value: "20.4%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

const fontPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-plex-serif",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="common notebook" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest"></link>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Mirror useTheme's resolution so the pre-paint theme matches.
                  // Absent key => follow the OS. A stored choice is sticky (no
                  // expiry). Tolerate the legacy { theme, timestamp } shape.
                  var raw = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var choice = 'system';

                  if (raw === 'light' || raw === 'dark') {
                    choice = raw;
                  } else if (raw) {
                    try {
                      var parsed = JSON.parse(raw);
                      if (parsed && (parsed.theme === 'light' || parsed.theme === 'dark')) {
                        choice = parsed.theme;
                      }
                    } catch (e) {}
                  }

                  var dark = choice === 'dark' || (choice === 'system' && systemDark);
                  var root = document.documentElement;
                  root.setAttribute('data-theme', dark ? 'dim' : 'retro');
                  if (dark) {
                    root.classList.add('dark');
                  } else {
                    root.classList.remove('dark');
                  }
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
          grid min-h-screen w-screen content-start
          ${fontSweetheart.variable}
          ${fontPlexSerif.variable}
        `}
      >
        {children}
      </body>
    </html>
  );
}
