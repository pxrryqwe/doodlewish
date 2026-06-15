import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow phone / other devices on the LAN to talk to the dev server.
  // Without this, Next.js 15+ rejects cross-origin dev requests so the
  // client bundle never hydrates and onClick handlers never bind.
  allowedDevOrigins: ["10.242.66.116", "*.local"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "www.figma.com" },
    ],
  },
};

export default nextConfig;
