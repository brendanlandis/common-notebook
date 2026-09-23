import type { NextConfig } from 'next';

/**
 * Sent with every response. The page policy, which needs a nonce per render, is
 * proxy.ts's (see app/lib/contentSecurityPolicy.ts).
 */
const SECURITY_HEADERS = [
  // No includeSubDomains: www.commonnotebook.com has no certificate (checked
  // 2026-09-23), and HSTS would turn its http redirect into an error.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites learn nothing from a link followed out of a note.
  { key: 'Referrer-Policy', value: 'same-origin' },
  // Never inside another site's frame. Enforced now, unlike the page policy:
  // nothing frames this app. X-Frame-Options is for browsers older than CSP 2.
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
