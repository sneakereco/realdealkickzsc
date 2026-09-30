import type { NextConfig } from "next";

import { env } from "@/config/env";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const supabaseRemotePattern = supabaseHostname
  ? ({
      protocol: "https",
      hostname: supabaseHostname,
      pathname: "/storage/v1/object/public/**",
    } as const)
  : null;

const nextConfig = {
  reactStrictMode: true,

  // OPTIMIZATION 1: Modern image formats and optimization
  images: {
    // Disable image optimization in development when using local Supabase
    unoptimized: true,
    formats: ["image/avif", "image/webp"], // Modern formats for 30-50% smaller files
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Responsive breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Icon/thumbnail sizes
    minimumCacheTTL: 60, // Cache images for 60 seconds minimum
    // FIXED: Added all qualities used in components
    qualities: [60, 75, 85, 90], // Product detail uses 75 (thumbnails) and 90 (main), product cards use 75
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    remotePatterns: [
      ...(supabaseRemotePattern ? [supabaseRemotePattern] : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      } as const,
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      } as const,
      {
        protocol: "https",
        hostname: "*.fastly.net",
      } as const,
    ],
  },

  // OPTIMIZATION 2: Reduce bundle size with package import optimization
  experimental: {
    optimizePackageImports: ["lucide-react"], // Tree-shake icons
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  // OPTIMIZATION 4: Compiler optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false, // Remove console.logs in production
  },

  // OPTIMIZATION 5: Headers for better caching
  headers() {
    return [
      // Store page caching
      {
        source: "/store/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=120",
          },
        ],
      },
      // Image optimization caching
      {
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Static assets caching
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              process.env.NODE_ENV === "production"
                ? "public, max-age=31536000, immutable"
                : "no-store",
          },
        ],
      },
    ];
  },
} satisfies NextConfig;

export default nextConfig;
