import type { Metadata } from "next";
import localFont from "next/font/local";
import "./css/screen.css";

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

const fontSweetheart = localFont({
  src: "./fonts/Sweetheart.otf",
  variable: "--font-sweetheart",
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
          ${fontClash.variable}
          ${fontChillax.variable}
          ${fontSweetheart.variable}
        `}
      >
        {children}
      </body>
    </html>
  );
}
