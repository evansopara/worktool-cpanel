import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Dev-only badge: it covers the sidebar, the mobile dock or the task panel's
  // close button wherever it sits. Build and runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
