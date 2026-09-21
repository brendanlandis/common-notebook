import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'slownames-strapi-media.s3.us-east-1.amazonaws.com',
        port: '',
      },
    ],
  },
  // The to-do pages lived under /todo until 2026-09-21. Old bookmarks land on
  // the same page at its new address.
  async redirects() {
    return [
      { source: '/todo', destination: '/', permanent: true },
      { source: '/todo/:path*', destination: '/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
