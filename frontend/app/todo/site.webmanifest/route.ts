import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: 'good enough notebook - to do',
    short_name: 'to do',
    start_url: '/todo',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/todo/icon.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        src: '/todo/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/todo/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/todo/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
    },
  });
}

