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
  this is not valid typescript syntax
};

export default nextConfig;
