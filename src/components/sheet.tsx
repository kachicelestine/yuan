"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type Detent = "closed" | "half" | "full";

type Props = {
  detent: Detent;
  onDetent: (detent: Detent) => void;
  /** Accessible name of the dialog. */
  label: string;
  children: React.ReactNode;
};

type Gesture = {
  pointer: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  /** px per ms, positive when moving down. */
  velocity: number;
  dragging: boolean;
};

// Snap points in px, in step with the .sheet heights in globals.css.
const halfHeight = () => Math.min(window.innerHeight * 0.64, 600);
const fullHeight = () => window.innerHeight - 20;

const noSubscribe = () => () => {};

/**
 * An iOS 26/27 sheet on a native modal <dialog>: an inset, floating glass card at the half
 * detent that grows edge to edge at full height. Drag anywhere outside the scrolling
 * content (marked data-sheet-scroll) to resize it, and it snaps to the nearest detent.
 */
export function Sheet({ detent, onDetent, label, children }: Props) {
  // Rendered into <body>, so a sheet can open from anywhere (even inside a <p> or <button>).
  const onClient = useSyncExternalStore(noSubscribe, () => true, () => false);
  // A sheet's contents aren't built until it first opens (most never do), then stay mounted
  // so their state survives closing and the close animation has something to show.
  const [opened, setOpened] = useState(detent !== "closed");
  if (!opened && detent !== "closed") setOpened(true);
  const ref = useRef<HTMLDialogElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (detent === "closed") {
      if (dialog.open) dialog.close();
    } else if (!dialog.open) {
      dialog.style.height = "";
      dialog.showModal();
    }
  }, [detent]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    swallowClick.current = false;
    const target = event.target as Element;
    if (event.button !== 0 || target.closest("[data-sheet-scroll]")) return;
    gesture.current = {
      pointer: event.pointerId,
      startY: event.clientY,
      startHeight: ref.current?.offsetHeight ?? 0,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    const dialog = ref.current;
    if (!g || !dialog || event.pointerId !== g.pointer) return;
    const dy = event.clientY - g.startY;
    if (!g.dragging) {
      if (Math.abs(dy) < 6) return;
      g.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      dialog.dataset.dragging = "";
    }
    const dt = event.timeStamp - g.lastTime;
    if (dt > 0) g.velocity = (event.clientY - g.lastY) / dt;
    g.lastY = event.clientY;
    g.lastTime = event.timeStamp;
    const max = fullHeight();
    const height = g.startHeight - dy;
    // Past full height the sheet resists, like a rubber band.
    dialog.style.height = `${height > max ? max + (height - max) * 0.15 : Math.max(height, 120)}px`;
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    const dialog = ref.current;
    if (!g || event.pointerId !== g.pointer) return;
    gesture.current = null;
    if (!g.dragging || !dialog) return;
    swallowClick.current = true;
    const height = dialog.offsetHeight;
    const half = halfHeight();
    let next: Detent;
    if (g.velocity > 0.5) next = height > half + 60 ? "half" : "closed";
    else if (g.velocity < -0.5) next = "full";
    else if (height < half * 0.6) next = "closed";
    else next = height < (half + fullHeight()) / 2 ? "half" : "full";
    delete dialog.dataset.dragging;
    // A closing sheet keeps its dragged height, so it leaves from where the finger let go.
    if (next !== "closed") dialog.style.height = "";
    onDetent(next);
  }

  if (!onClient) return null;

  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      data-detent={detent}
      onCancel={(event) => {
        event.preventDefault();
        onDetent("closed");
      }}
      onClose={() => {
        if (detent !== "closed") onDetent("closed");
      }}
      // Clicks on the dialog element itself come from its ::backdrop, the media above the sheet.
      onClick={(event) => {
        if (event.target === event.currentTarget) onDetent("closed");
      }}
      className="sheet glass-sheet"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          // The click that ends a drag shouldn't also press whatever is under the finger.
          if (!swallowClick.current) return;
          swallowClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        className="flex h-full flex-col"
      >
        <button
          type="button"
          onClick={() => onDetent(detent === "full" ? "half" : "full")}
          aria-label={detent === "full" ? "Shrink sheet" : "Expand sheet"}
          className="mx-auto grid h-5 w-16 shrink-0 touch-none place-items-center"
        >
          <span className="h-[5px] w-9 rounded-full bg-white/35" />
        </button>
        {opened && children}
      </div>
    </dialog>,
    document.body,
  );
}

