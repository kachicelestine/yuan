import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Embedded Postgres ships a WebAssembly build; load it from node_modules, not the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  // The floating dev badge sits on top of the mobile tab bar; build errors still show.
  devIndicators: false,
  experimental: {
    // Detects lost connections, retries navigations, and powers the offline banner.
    useOffline: true,
  },
  async headers() {
    return [
      {
        // The service worker must never be cached, or fixes to it would never reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  images: {
    // Product and creator photos are served by Unsplash's image CDN, which
    // resizes on the fly, so we skip Next's optimizer and build the URLs ourselves.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    qualities: [72],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
