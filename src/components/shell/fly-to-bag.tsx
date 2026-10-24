"use client";

import { useEffect } from "react";
import { getImageProps } from "next/image";

/**
 * When something is added to the bag, its photo arcs from where you tapped into the bag
 * button, which then bumps. Reduced motion skips the flight and keeps the bump.
 */
export function FlyToBag() {
  useEffect(() => {
    let from = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const track = (e: PointerEvent) => {
      from = { x: e.clientX, y: e.clientY };
    };

    function onAdd(e: Event) {
      const { image } = (e as CustomEvent<{ image: string }>).detail;
      const bag = [...document.querySelectorAll<HTMLElement>("[data-bag]")].find((el) => el.getBoundingClientRect().width > 0);
      if (!bag) return;
      const to = bag.getBoundingClientRect();
      const bump = () => bag.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 380, easing: "cubic-bezier(0.32, 1.45, 0.45, 1)" });
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return bump();

      const img = document.createElement("img");
      img.src = getImageProps({ src: image, alt: "", width: 56, height: 56 }).props.src;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      Object.assign(img.style, { position: "fixed", left: "0", top: "0", width: "56px", height: "56px", borderRadius: "16px", objectFit: "cover", zIndex: "90", pointerEvents: "none", boxShadow: "0 10px 30px rgb(0 0 0 / 0.45)" });
      document.body.append(img);
      const dx = to.left + to.width / 2 - 28;
      const dy = to.top + to.height / 2 - 28;
      const sx = from.x - 28;
      const sy = from.y - 28;
      // An arc: up and over, then down into the bag.
      const peak = Math.min(sy, dy) - 120;
      img
        .animate(
          [
            { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1 },
            { transform: `translate(${(sx + dx) / 2}px, ${peak}px) scale(0.85)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.4 },
          ],
          { duration: 720, easing: "cubic-bezier(0.45, 0, 0.3, 1)" },
        )
        .finished.then(() => {
          img.remove();
          bump();
        });
    }

    window.addEventListener("pointerdown", track, { capture: true, passive: true });
    window.addEventListener("app:add", onAdd);
    return () => {
      window.removeEventListener("pointerdown", track, { capture: true });
      window.removeEventListener("app:add", onAdd);
    };
  }, []);

  return null;
}
