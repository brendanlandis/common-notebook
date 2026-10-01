import type { NextConfig } from 'next';

/**
 * Sent with every response. The page policy, which needs a nonce per render, is
 * proxy.ts's (see app/lib/contentSecurityPolicy.ts).
 */
const SECURITY_HEADERS = [
  // No includeSubDomains: the app is served from app.commonnotebook.com
  // (since 2026-10-01), which has no names under it for it to cover.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites learn nothing from a link followed out of a note.
  { key: 'Referrer-Policy', value: 'same-origin' },
  // Never inside another site's frame: nothing frames this app. A page's own
  // policy from proxy.ts replaces this header, so it repeats the rule.
  // X-Frame-Options is for browsers older than CSP 2.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Settings asks for the location, to find the time zone; nothing else is used.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'slownames-strapi-media.s3.us-east-1.amazonaws.com',
        port: '',
      },
    ],
  },
};

export default nextConfig;
