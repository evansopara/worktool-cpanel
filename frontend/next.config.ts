import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Dev-only badge; bottom-left would cover the sidebar's sign-out and the mobile dock.
  devIndicators: { position: 'top-right' },
};

export default nextConfig;
