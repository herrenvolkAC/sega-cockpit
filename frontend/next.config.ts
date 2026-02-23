import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/recepciones/:path*',
        destination: 'http://localhost:3001/recepciones/:path*',
      },
      {
        source: '/fulfillment/:path*',
        destination: 'http://localhost:3001/fulfillment/:path*',
      },
    ]
  },
};

export default nextConfig;
