"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { useMoney } from "@/components/price";
import { getProduct, type ChatMessage, type Seller } from "@/lib/catalog";
import { quickReplies, sellerReply } from "@/lib/inbox";

/**
 * A chat with one seller. Their messages arrive translated (tap to see the original),
 * yours go out in their language, and quick replies cover the usual questions.
 */
export function ChatThread({ seller, replyHours, initial }: { seller: Seller; replyHours: number; initial: ChatMessage[] }) {
  const money = useMoney();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [translate, setTranslate] = useState(true);
  const [originals, setOriginals] = useState<Record<string, boolean>>({});
  const end = useRef<HTMLLIElement>(null);
  const count = useRef(initial.length);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, typing]);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    count.current += 2;
    const n = count.current;
    setMessages((m) => [...m, { id: `me-${n}`, from: "me", text: t, at: "Now" }]);
    setDraft("");
    setTimeout(() => setTyping(true), 500);
    setTimeout(() => {
      const reply = sellerReply(t);
      setTyping(false);
      setMessages((m) => [...m, { id: `s-${n}`, from: "seller", text: reply.text, original: reply.original, at: "Now" }]);
    }, 1900);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[760px] flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-canvas/75 px-3.5 pb-3 backdrop-blur-2xl lg:pt-4">
        <div className="flex items-center gap-3">
          <Link href="/inbox" aria-label="Back to inbox" className="glass grid size-11 shrink-0 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </Link>
          <Link href={`/s/${seller.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="relative shrink-0">
              <Image src={seller.avatar} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-full object-cover" />
              <span className="absolute right-0 bottom-0 size-3 rounded-full bg-positive ring-2 ring-canvas" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                <span className="truncate">{seller.name}</span>
                {seller.verified && <VerifiedBadge className="size-3.5" />}
              </span>
              <span className="block truncate text-xs text-ink-2">Online · usually replies within {replyHours} h</span>
            </span>
          </Link>
        </div>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-2xl bg-agent/10 px-3 py-2 text-xs text-ink-2">
          <Icon name="globe" className="size-4 shrink-0 text-agent" />
          <span className="flex-1">
            <b className="font-semibold text-ink">Auto-translate {translate ? "on" : "off"}</b> · you write English, they read 中文
          </span>
          <input type="checkbox" role="switch" checked={translate} onChange={(e) => setTranslate(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10 rounded-full bg-white/20 transition-colors peer-checked:bg-agent/80 peer-focus-visible:ring-2 peer-focus-visible:ring-white">
            <span className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform duration-300 ${translate ? "translate-x-4" : ""}`} />
          </span>
        </label>
      </header>

      <ol aria-live="polite" className="flex flex-1 flex-col gap-2 px-3.5 pt-4 pb-48">
        <li className="mx-auto mb-2 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-ink-3">Messages are protected · pay only through checkout</li>
        {messages.map((m) => {
          const showOriginal = m.original && (!translate || originals[m.id]);
          const product = m.product ? getProduct(m.product) : undefined;
          return (
            <li key={m.id} className={`flex max-w-[84%] flex-col gap-1 ${m.from === "me" ? "items-end self-end" : "items-start"} motion-safe:animate-rise`}>
              {m.image && <Image src={m.image} alt="Photo from the seller" width={220} height={220} sizes="220px" className="size-[220px] rounded-[22px] object-cover" />}
              {product && (
                <Link href={`/p/${product.slug}`} className="glass flex w-[260px] items-center gap-3 rounded-[20px] p-2.5">
                  <Image src={product.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{product.title}</span>
                    <span className="block font-display text-base font-extrabold">{product.price ? money(product.price) : "Quote"}</span>
                  </span>
                </Link>
              )}
              <p
                className={`rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug ${m.from === "me" ? "rounded-br-md bg-accent" : "glass-inset rounded-bl-md"}`}
                lang={showOriginal ? "zh" : undefined}
              >
                {showOriginal ? m.original : m.text}
              </p>
              <span className="flex items-center gap-2 px-1 text-[11px] text-ink-3">
                {m.at}
                {m.original && translate && (
                  <button type="button" onClick={() => setOriginals((o) => ({ ...o, [m.id]: !o[m.id] }))} className="flex items-center gap-1 font-semibold text-agent">
                    <Icon name="globe" className="size-3" />
                    {originals[m.id] ? "Show translation" : "Translated · Show original"}
                  </button>
                )}
              </span>
            </li>
          );
        })}
        {typing && (
          <li className="glass-inset flex w-fit items-center gap-1 rounded-[20px] rounded-bl-md px-4 py-3.5" aria-label={`${seller.name} is typing`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 animate-blink rounded-full bg-white/70" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </li>
        )}
        <li ref={end} aria-hidden="true" className="scroll-mb-[200px]" />
      </ol>

      <div className="edge-bottom pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[760px] px-3.5 pt-6 lg:left-[256px]">
        <div className="no-scrollbar -mx-3.5 mb-2 flex gap-2 overflow-x-auto px-3.5">
          {quickReplies.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="glass h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold">
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
          <button type="button" aria-label="Attach a photo" className="glass grid size-12 shrink-0 place-items-center rounded-full">
            <Icon name="plus" />
          </button>
          <label className="glass flex h-12 min-w-0 flex-1 items-center rounded-full px-4">
            <span className="sr-only">Message {seller.name}</span>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write in any language" enterKeyHint="send" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
          </label>
          <button type="submit" disabled={!draft.trim()} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent transition-opacity disabled:opacity-40">
            <Icon name="send" className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
