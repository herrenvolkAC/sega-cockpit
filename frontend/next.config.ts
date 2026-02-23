import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/fulfillment/:path*',
        destination: 'http://localhost:3001/fulfillment/:path*',
      },
    ]
  },
};

export default nextConfig;
