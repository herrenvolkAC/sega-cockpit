import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/recepciones/:path*',
        destination: 'http://localhost:3001/recepciones/:path*',
      },
      {
        source: '/api/stock-almacenaje/:path*',
        destination: 'http://localhost:3001/stock-almacenaje/:path*',
      },
      {
        source: '/api/stock/:path*',
        destination: 'http://localhost:3001/stock/:path*',
      },
      {
        source: '/api/fulfillment/:path*',
        destination: 'http://localhost:3001/fulfillment/:path*',
      },
      {
        source: '/api/productividad/:path*',
        destination: 'http://localhost:3001/productividad/:path*',
      },
      {
        source: '/api/status/:path*',
        destination: 'http://localhost:3001/status/:path*',
      },
      {
        source: '/api/detail/:path*',
        destination: 'http://localhost:3001/detail/:path*',
      },
      {
        source: '/fulfillment/:path*',
        destination: 'http://localhost:3001/fulfillment/:path*',
      },
      {
        source: '/stock-almacenaje/:path*',
        destination: 'http://localhost:3001/stock-almacenaje/:path*',
      },
      {
        source: '/expediciones/:path*',
        destination: 'http://localhost:3001/expediciones/:path*',
      },
    ]
  },
};

export default nextConfig;
