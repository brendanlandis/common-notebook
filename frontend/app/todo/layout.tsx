import type { Metadata } from "next";
import Script from "next/script";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "to do",
    description: "to do",
    manifest: '/todo/site.webmanifest',
    icons: {
      icon: [
        { url: '/todo/icon.png', sizes: '32x32', type: 'image/png' },
        { url: '/todo/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/todo/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/todo/apple-icon.png', sizes: '180x180', type: 'image/png' }
      ],
      other: [
        {
          rel: 'apple-touch-icon-precomposed',
          url: '/todo/apple-touch-icon-precomposed.png',
        },
      ],
    },
  };
}

export default function TodoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="todo-icons"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var links = document.querySelectorAll('link[rel*="icon"]');
              links.forEach(function(l) { l.remove(); });
              
              var icon = document.createElement('link');
              icon.rel = 'icon';
              icon.href = '/todo/icon.png';
              icon.sizes = '32x32';
              icon.type = 'image/png';
              document.head.appendChild(icon);
              
              var apple = document.createElement('link');
              apple.rel = 'apple-touch-icon';
              apple.href = '/todo/apple-icon.png';
              apple.sizes = '180x180';
              apple.type = 'image/png';
              document.head.appendChild(apple);
              
              var precomposed = document.createElement('link');
              precomposed.rel = 'apple-touch-icon-precomposed';
              precomposed.href = '/todo/apple-touch-icon-precomposed.png';
              precomposed.sizes = '180x180';
              precomposed.type = 'image/png';
              document.head.appendChild(precomposed);
              
              // Add 192x192 and 512x512 for Android/Firefox
              var icon192 = document.createElement('link');
              icon192.rel = 'icon';
              icon192.href = '/todo/icon-192.png';
              icon192.sizes = '192x192';
              icon192.type = 'image/png';
              document.head.appendChild(icon192);
              
              var icon512 = document.createElement('link');
              icon512.rel = 'icon';
              icon512.href = '/todo/icon-512.png';
              icon512.sizes = '512x512';
              icon512.type = 'image/png';
              document.head.appendChild(icon512);
              
              // Add manifest link
              var manifest = document.createElement('link');
              manifest.rel = 'manifest';
              manifest.href = '/todo/site.webmanifest';
              document.head.appendChild(manifest);
            })();
          `,
        }}
      />
      {children}
    </>
  );
}

