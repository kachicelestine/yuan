"use client";

import Image from "next/image";
import { useState } from "react";

/** Swipeable on phones, a large hero with thumbnails on desktop. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto lg:hidden"
      >
        {images.map((src, i) => (
          <div key={src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image src={src} alt={i === 0 ? title : ""} fill loading={i === 0 ? "eager" : undefined} sizes="100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div aria-hidden="true" className="flex justify-center gap-1.5 lg:hidden">
          {images.map((src, i) => (
            <span key={src} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-[18px] bg-white" : "w-1.5 bg-white/30"}`} />
          ))}
        </div>
      )}

      <div className="hidden flex-col gap-3 lg:flex">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[30px] bg-surface">
          <Image src={images[index]} alt={title} fill loading="eager" sizes="(min-width: 1280px) 760px, 60vw" className="object-cover" />
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-3">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Photo ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={`relative aspect-square overflow-hidden rounded-[18px] transition-shadow ${i === index ? "shadow-[0_0_0_2px_#fff]" : "shadow-[0_0_0_0.75px_rgb(255_255_255/0.14)]"}`}
              >
                <Image src={src} alt="" fill sizes="140px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

