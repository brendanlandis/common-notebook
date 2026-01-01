import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: 'good enough notebook - notes',
    short_name: 'notes',
    start_url: '/notes',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/notes/icon.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        src: '/notes/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/notes/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/notes/icon-512.png',
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

