import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** Search engines get the shop; everything behind an account stays out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/checkout", "/creator", "/gift/", "/inbox", "/me", "/notifications", "/orders", "/pay/", "/sell", "/signin"] },
    sitemap: new URL("/sitemap.xml", brand.url).toString(),
  };
}
