import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { getProductSlugs, getSellers } from "@/server/catalog";

const PAGES = ["/", "/discover", "/live", "/drops", "/rankings", "/c", "/business", "/help", "/terms", "/privacy", "/returns"];

/** Everything worth finding from a search: the main pages, every listing and every shop. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, sellers] = await Promise.all([getProductSlugs(), getSellers()]);
  const url = (path: string) => new URL(path, brand.url).toString();
  return [...PAGES.map((p) => ({ url: url(p) })), ...slugs.map((slug) => ({ url: url(`/p/${slug}`) })), ...sellers.map((s) => ({ url: url(`/s/${s.id}`) }))];
}
