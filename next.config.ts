import type { NextConfig } from "next";
import { DEVICE_SIZES, IMAGE_SIZES, QUALITIES } from "./src/lib/image-config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The Docker image runs the self-contained server (`.next/standalone`); local builds keep
  // the normal layout (standalone output needs symlink rights on Windows).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Embedded Postgres ships a WebAssembly build; load it from node_modules, not the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  // The floating dev badge sits on top of the mobile tab bar; build errors still show.
  devIndicators: false,
  // The React Compiler was measured and left off: its memoization code made every page's
  // JavaScript 10–15% larger and first-load main-thread time longer. If a screen ever needs
  // it for interactions, opt that component in with `compilationMode: "annotation"`.
  experimental: {
    // Detects lost connections, retries navigations, and powers the offline banner.
    useOffline: true,
    // Tailwind's CSS (~20 KB gzipped) ships inside the HTML instead of as a render-blocking
    // stylesheet. A/B-tested on a 4G phone: first paint 0.15–0.45 s sooner on most pages,
    // for ~60 KB more HTML per full page load (Next 16 also copies the CSS into the RSC data).
    inlineCss: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The camera and microphone are for filming posts, going live, voice and photo search.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
          // Static pages can't carry script nonces, so this limits what doesn't need one.
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
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
    // Unsplash's CDN makes each rendition at the exact size; our /img route caches it and
    // serves it from our own origin (see src/lib/image-loader.ts). Next's built-in optimizer
    // would pull every full-size original first (0.5–1 MB each) and resize it itself.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: DEVICE_SIZES,
    imageSizes: IMAGE_SIZES,
    qualities: QUALITIES,
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
