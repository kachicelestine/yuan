"use client";

import { getImageProps } from "next/image";
import { reframe } from "@/lib/images";

const hero = { alt: "", fill: true, sizes: "(min-width: 1100px) 1050px, 100vw" } as const;

/**
 * The live lobby's featured room: 4:5 on phones, 16:9 from 640 px up, each with a photo
 * cropped to that shape. (A client component because the image loader runs client-side.)
 */
export function FeaturedCover({ image }: { image: string }) {
  const wide = getImageProps({ ...hero, src: reframe(image, "16:9") }).props;
  const tall = getImageProps({ ...hero, src: reframe(image, "4:5"), loading: "eager", fetchPriority: "high" }).props;
  return (
    <picture>
      <source media="(min-width: 640px)" srcSet={wide.srcSet} sizes={wide.sizes} />
      {/* Art direction: a plain <img> inside <picture>, with props from getImageProps. */}
      <img {...tall} alt="" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
    </picture>
  );
}
