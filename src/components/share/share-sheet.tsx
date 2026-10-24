"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useMakePoll } from "@/components/poll/poll-screen";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import { brand } from "@/config/brand";
import { productsInCategory, similarProducts, type Product } from "@/lib/catalog";
import { shareInfoAction } from "@/server/actions/creator";

type Target = { id: string; label: string; color: string; glyph: React.ReactNode; href?: (url: string, text: string) => string };

const targets: Target[] = [
  { id: "whatsapp", label: "WhatsApp", color: "#25D366", glyph: <Icon name="chat" className="size-6" />, href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { id: "telegram", label: "Telegram", color: "#229ED9", glyph: <Icon name="send" className="size-6" />, href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: "x", label: "X", color: "#000000", glyph: <span className="text-xl font-black">𝕏</span>, href: (u, t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { id: "facebook", label: "Facebook", color: "#1877F2", glyph: <span className="font-display text-2xl font-black">f</span>, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
];

/** Share button that opens a sheet with a product poster, share targets, and a saveable image. */
export function ShareButton({ product, className = "" }: { product: Product; className?: string }) {
  const [detent, setDetent] = useState<Detent>("closed");
  return (
    <>
      <button type="button" aria-label="Share" onClick={() => setDetent("half")} className={className}>
        <Icon name="share" className="size-5" />
      </button>
      <Sheet detent={detent} onDetent={setDetent} label="Share">
        <ShareContent product={product} onClose={() => setDetent("closed")} />
      </Sheet>
    </>
  );
}

function ShareContent({ product, onClose }: { product: Product; onClose: () => void }) {
  const money = useMoney();
  const makePoll = useMakePoll();
  const rival = similarProducts(product, 1)[0] ?? productsInCategory(product.category).find((p) => p.slug !== product.slug);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const price = product.price === undefined ? "Ask for a landed quote" : money(product.price);
  const text = `${product.title}, ${price} on ${brand.name}`;
  // Signed in, the link carries the person's creator code, so orders it brings in earn them the shop's commission.
  const { account } = useStore();
  const [earn, setEarn] = useState<{ code: string | null; rate: number } | null>(null);
  useEffect(() => {
    let live = true;
    void shareInfoAction(product.sellerId)
      .then((r) => live && setEarn(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [product.sellerId, account?.id]);
  const url = () => `${window.location.origin}/p/${product.slug}${earn?.code ? `?ref=${earn.code}` : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
    } catch {
      // Clipboard blocked: the link is still visible to select by hand.
    }
  }

  async function more() {
    try {
      if (navigator.share) await navigator.share({ text, url: url() });
    } catch {
      // Dismissed.
    }
  }

  // Draws a 1080×1350 poster on a canvas. The photo comes from our own image optimizer, so the canvas can be exported.
  async function savePoster() {
    setSaving("busy");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      const photo = new window.Image();
      photo.crossOrigin = "anonymous";
      photo.src = getImageProps({ src: product.images[0], alt: "", width: 1080, height: 1350 }).props.src;
      await photo.decode();
      ctx.fillStyle = "#0b0b0e";
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(48, 48, 984, 984, 56);
      ctx.clip();
      ctx.drawImage(photo, 48, 48, 984, 984);
      ctx.restore();
      ctx.fillStyle = "#cc3a17";
      ctx.beginPath();
      ctx.roundRect(48, 1080, 96, 96, 24);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 56px serif";
      ctx.textAlign = "center";
      ctx.fillText(brand.seal, 96, 1148);
      ctx.textAlign = "left";
      ctx.font = "bold 44px system-ui, sans-serif";
      ctx.fillText(product.title.slice(0, 34), 172, 1120);
      ctx.font = "800 64px system-ui, sans-serif";
      ctx.fillText(price, 172, 1192);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "32px system-ui, sans-serif";
      ctx.fillText(`${brand.name} · ${brand.tagline}`, 48, 1290);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("export failed");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${product.slug}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      setSaving("done");
    } catch {
      setSaving("failed");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
        <h2 className="flex-1 font-display text-[22px] font-bold tracking-[-0.02em]">Share</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
          <Icon name="close" className="size-[18px]" />
        </button>
      </header>
      <div data-sheet-scroll className="no-scrollbar pb-safe flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 [&>*]:shrink-0">
        <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[26px] bg-black shadow-[0_20px_50px_rgb(0_0_0/0.45)] ring-1 ring-white/10">
          <span className="relative block aspect-square">
            <Image src={product.images[0]} alt="" fill sizes="260px" className="object-cover" />
          </span>
          <span className="flex items-center gap-2.5 p-3">
            <span className="seal grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-lg text-white">{brand.seal}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{product.title}</span>
              <span className="block font-display text-base font-extrabold">{price}</span>
            </span>
          </span>
        </div>

        <ul className="grid grid-cols-4 gap-2">
          {targets.map((t) => (
            <li key={t.id}>
              <a
                href={t.href?.(typeof window === "undefined" ? "" : url(), text)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 text-xs font-semibold text-ink-2"
              >
                <span className="grid size-14 place-items-center rounded-full text-white ring-1 ring-white/15" style={{ background: t.color }}>
                  {t.glyph}
                </span>
                {t.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={copy} className="glass-inset flex h-[60px] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold">
            <Icon name={copied ? "check" : "share"} className={`size-5 ${copied ? "text-positive" : ""}`} />
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button type="button" onClick={savePoster} disabled={saving === "busy"} className="glass-inset flex h-[60px] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold">
            <Icon name={saving === "done" ? "check" : "camera"} className={`size-5 ${saving === "done" ? "text-positive" : ""}`} />
            {saving === "busy" ? "Saving…" : saving === "done" ? "Saved" : saving === "failed" ? "Try again" : "Save poster"}
          </button>
          <button type="button" onClick={more} className="glass-inset flex h-[60px] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold">
            <Icon name="plus" className="size-5" />
            More
          </button>
        </div>

        {rival && (
          <button type="button" onClick={() => makePoll([product.slug, rival.slug], "This or that?")} className="glass-inset flex items-center gap-3 rounded-2xl p-3.5 text-left text-[13px] text-ink-2">
            <span className="flex shrink-0 -space-x-3">
              <Image src={product.images[0]} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-xl object-cover ring-2 ring-surface" />
              <Image src={rival.images[0]} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-xl object-cover ring-2 ring-surface" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block font-semibold text-ink">Can&apos;t decide? Ask friends</b>
              This or {rival.title.toLowerCase()}: they vote with one tap.
            </span>
            <Icon name="forward" className="size-4 shrink-0 text-ink-3" />
          </button>
        )}

        {earn && earn.rate > 0 && (
          <p className="glass-inset flex items-center gap-3 rounded-2xl p-3.5 text-[13px] text-ink-2">
            <Icon name="gift" className="size-6 shrink-0 text-save" />
            {earn.code ? (
              <span>
                <b className="font-semibold text-ink">You earn {Math.round(earn.rate * 100)}% on orders from your link</b>
                {product.price !== undefined && <> (about {money(product.price * earn.rate)} each)</>}, paid once they arrive.{" "}
                <Link href="/creator" className="font-semibold text-agent">
                  Creator hub
                </Link>
              </span>
            ) : (
              <span>
                <Link href={`/signin?next=/p/${product.slug}`} className="font-semibold text-agent">
                  Sign in
                </Link>{" "}
                to earn {Math.round(earn.rate * 100)}% on every order your link brings in.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

