import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name}: ${brand.tagline}`,
    short_name: brand.name,
    description: "Shoppable videos, live rooms and factory-direct prices on everything made in China.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050506",
    theme_color: "#050506",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Search", url: "/search" },
      { name: "Live now", url: "/live" },
      { name: "Drops", url: "/drops" },
      { name: "Bag", url: "/checkout" },
    ],
  };
}
