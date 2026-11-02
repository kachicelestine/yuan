"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { useMoney } from "@/components/price";
import { TranslateText } from "@/components/translate-text";
import { photoBlob, photoFromFile, type ShrunkPhoto } from "@/lib/photo";
import type { MessageView, Side } from "@/modules/messaging";
import { replyAsShopAction, sendToShopAction, startChatPhotoAction } from "@/server/actions/messages";

export type ChatProduct = { slug: string; title: string; image: string; price: number | null };

const QUICK: Record<Side, string[]> = {
  buyer: ["Is this in stock?", "How long to ship to me?", "Can you do a bulk price?", "Can you customise it?"],
  shop: ["Yes, it's in stock.", "It ships within 2 days.", "Thanks for your order!"],
};

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * A conversation between a shopper and a shop, from either side. New messages arrive by
 * polling while the thread is open; a product card or a photo can ride along with a message.
 */
export function ChatThread({
  side,
  conversationId: initialId,
  sellerId,
  title,
  avatar,
  verified,
  subtitle,
  back,
  initial,
  products,
  about,
  shareable = [],
}: {
  side: Side;
  conversationId: string | null;
  sellerId: string;
  title: string;
  avatar: string | null;
  verified: boolean;
  subtitle: string;
  back: string;
  initial: MessageView[];
  products: Record<string, ChatProduct>;
  /** A product the shopper came from, attached to their next message. */
  about?: ChatProduct | null;
  /** Listings the shop can share in a reply. */
  shareable?: ChatProduct[];
}) {
  const money = useMoney();
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initial);
  const [known, setKnown] = useState(products);
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<ChatProduct | null>(about ?? null);
  const [photo, setPhoto] = useState<ShrunkPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // New messages from the other side, every few seconds while the thread is on screen.
  useEffect(() => {
    if (!conversationId) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const last = messages.at(-1)?.at;
      fetch(`/api/messages/${conversationId}${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ messages: MessageView[] }>) : null))
        .then((r) => {
          if (!r?.messages.length) return;
          setMessages((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [conversationId, messages]);

  function send(text: string) {
    const t = text.trim();
    if (!t && !attached && !photo) return;
    const product = attached;
    const picture = photo;
    start(async () => {
      const signIn = () => router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
      // A photo goes up to private storage first; the message carries its key.
      let key: string | null = null;
      if (picture) {
        const blob = photoBlob(picture);
        const ticket = await startChatPhotoAction({ contentType: "image/jpeg", bytes: blob.size });
        if (!ticket.ok) return ticket.code === "sign_in_required" ? signIn() : setError(ticket.message);
        const put = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: blob }).catch(() => null);
        if (!put?.ok) return setError("The photo didn't upload. Try again.");
        key = ticket.photo;
      }
      const r = side === "buyer" ? await sendToShopAction(sellerId, t, product?.slug ?? null, key) : await replyAsShopAction(conversationId!, t, product?.slug ?? null, key);
      if (!r.ok) {
        if (r.code === "sign_in_required") return signIn();
        return setError(r.message);
      }
      const started = (r as { conversationId?: string }).conversationId;
      if (started && !conversationId) setConversationId(started);
      if (product) setKnown((k) => ({ ...k, [product.slug]: product }));
      setMessages((m) => [...m, r.message]);
      setDraft("");
      setAttached(null);
      setPhoto(null);
      setError(null);
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[760px] flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-canvas/75 px-3.5 pb-3 backdrop-blur-2xl lg:pt-4">
        <div className="flex items-center gap-3">
          <Link href={back} aria-label="Back to inbox" className="glass grid size-11 shrink-0 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </Link>
          <Link href={side === "buyer" ? `/s/${sellerId}` : back} className="flex min-w-0 flex-1 items-center gap-2.5">
            {avatar ? (
              <Image src={avatar} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold">{title[0]?.toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                <span className="truncate">{title}</span>
                {verified && <VerifiedBadge className="size-3.5" />}
              </span>
              <span className="block truncate text-xs text-ink-2">{subtitle}</span>
            </span>
          </Link>
        </div>
      </header>

      <ol aria-live="polite" className="flex flex-1 flex-col gap-2 px-3.5 pt-4 pb-48">
        <li className="mx-auto mb-2 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-ink-3">Pay only through checkout: Protect covers orders, not payments in chat</li>
        {messages.length === 0 && (
          <li className="mx-auto mt-6 max-w-[34ch] text-center text-sm text-ink-2">{side === "buyer" ? `Ask ${title} anything: stock, custom orders, shipping to your country.` : "No messages yet."}</li>
        )}
        {messages.map((m) => {
          const mine = m.from === side;
          const product = m.productSlug ? known[m.productSlug] : undefined;
          return (
            <li key={m.id} className={`flex max-w-[84%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start"} motion-safe:animate-rise`}>
              {m.productSlug && (
                <Link href={`/p/${m.productSlug}`} className="glass flex w-[260px] items-center gap-3 rounded-[20px] p-2.5">
                  {product && <Image src={product.image} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{product?.title ?? "See the listing"}</span>
                    {product && <span className="block font-display text-base font-extrabold">{product.price !== null ? money(product.price) : "Quote"}</span>}
                  </span>
                </Link>
              )}
              {m.photo && (
                <a href={m.photo} target="_blank" rel="noopener noreferrer" aria-label={mine ? "Your photo, full size" : "Their photo, full size"} className="block overflow-hidden rounded-[20px]">
                  {/* A private, short-lived link: shown as is, never through the image optimiser's cache. */}
                  <Image src={m.photo} alt="" width={240} height={240} unoptimized className="h-auto max-h-[320px] w-[240px] object-cover" />
                </a>
              )}
              {m.text && <p className={`rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap ${mine ? "rounded-br-md bg-accent" : "glass-inset rounded-bl-md"}`}>{m.text}</p>}
              {m.text && !mine && (
                <span className="px-1">
                  <TranslateText text={m.text} />
                </span>
              )}
              <span className="px-1 text-[11px] text-ink-3">{time(m.at)}</span>
            </li>
          );
        })}
        <li ref={end} aria-hidden="true" className="scroll-mb-[200px]" />
      </ol>

      <div className="edge-bottom pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[760px] px-3.5 pt-6 lg:left-[256px]">
        {error && (
          <p role="alert" className="mb-2 text-center text-xs font-semibold text-like">
            {error}
          </p>
        )}
        {picking && shareable.length > 0 && (
          <ul className="glass no-scrollbar mb-2 flex max-h-[220px] flex-col overflow-y-auto rounded-[20px] p-1.5">
            {shareable.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setAttached(p);
                    setPicking(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/5"
                >
                  <Image src={p.image} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {attached && (
          <div className="glass mb-2 flex items-center gap-2.5 rounded-[20px] p-2">
            <Image src={attached.image} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{attached.title}</span>
            <button type="button" onClick={() => setAttached(null)} aria-label="Remove the listing" className="grid size-8 place-items-center rounded-full">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        )}
        {photo && (
          <div className="glass mb-2 flex items-center gap-2.5 rounded-[20px] p-2">
            <Image src={photo.url} alt="" width={36} height={36} unoptimized className="size-9 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">Photo ready to send</span>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove the photo" className="grid size-8 place-items-center rounded-full">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        )}
        <div className="no-scrollbar -mx-3.5 mb-2 flex gap-2 overflow-x-auto px-3.5">
          {QUICK[side].map((q) => (
            <button key={q} type="button" disabled={busy || (side === "shop" && !conversationId)} onClick={() => send(q)} className="glass h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold">
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2"
        >
          {shareable.length > 0 && (
            <button type="button" onClick={() => setPicking((v) => !v)} aria-label="Share a listing" className="glass grid size-12 shrink-0 place-items-center rounded-full">
              <Icon name="plus" />
            </button>
          )}
          <label className="glass grid size-12 shrink-0 cursor-pointer place-items-center rounded-full">
            <span className="sr-only">Add a photo</span>
            <Icon name="camera" className="size-5" />
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setPhoto(await photoFromFile(file, 1600));
                  setError(null);
                } catch {
                  setError("That file isn't a photo we can read.");
                }
              }}
            />
          </label>
          <label className="glass flex h-12 min-w-0 flex-1 items-center rounded-full px-4">
            <span className="sr-only">Message {title}</span>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="Write a message" enterKeyHint="send" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
          </label>
          <button type="submit" disabled={busy || (!draft.trim() && !attached && !photo)} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent transition-opacity disabled:opacity-40">
            <Icon name="send" className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
