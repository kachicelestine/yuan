"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { Watch } from "@/components/product/price-history";
import { ProductCard } from "@/components/product/product-card";
import { useStore } from "@/components/providers";
import { VoiceSearch } from "@/components/search/voice-search";
import { brand } from "@/config/brand";
import { askSuggestions, type AskAction, type AskBlock, type AskEvent, type AskTurn } from "@/lib/ask";
import { photoFromFile, type ShrunkPhoto } from "@/lib/photo";
import { useStored } from "@/lib/use-stored";
import { openRfqAction } from "@/server/actions/sourcing";

type Message = { id: number; role: "user" | "agent"; text?: string; photo?: string; steps: string[]; blocks: AskBlock[] | null; error?: string };
type ActionState = { state: "done" | "skipped" | "failed"; note?: string };

/** "Ask": a shopping assistant that finds, compares and prices things, and acts only with your OK. */
export function AskScreen({ enabled, signedIn, earlier = [] }: { enabled: boolean; signedIn: boolean; earlier?: AskTurn[] }) {
  const params = useSearchParams();
  const { market, addToCart } = useStore();
  // The conversation kept from before (on any device), words only.
  const [messages, setMessages] = useState<Message[]>(() =>
    earlier.map((t, i): Message => (t.role === "user" ? { id: -earlier.length + i, role: "user", text: t.text, steps: [], blocks: null } : { id: -earlier.length + i, role: "agent", steps: [], blocks: [{ kind: "text", text: t.text }] })),
  );
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<ShrunkPhoto | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [voice, setVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acted, setActed] = useState<Record<string, ActionState>>({});
  const [watches, setWatches] = useStored<Watch[]>("app.watches", []);
  const end = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const nextId = useRef(1);

  const update = (id: number, fn: (m: Message) => Message) => setMessages((list) => list.map((m) => (m.id === id ? fn(m) : m)));

  async function send(text: string) {
    const attached = photo;
    const t = text.trim() || (attached ? "Find this for me." : "");
    if (!t || busy) return;
    const id = nextId.current;
    nextId.current += 2;
    // Context for the model: earlier questions and what was said back (not the cards).
    const turns: AskTurn[] = [
      ...messages.flatMap((m): AskTurn[] => (m.role === "user" ? [{ role: "user", text: m.text! }] : m.blocks?.some((b) => b.kind === "text") ? [{ role: "assistant", text: m.blocks.flatMap((b) => (b.kind === "text" ? [b.text] : [])).join("\n") }] : [])).slice(-10),
      { role: "user", text: t, ...(attached && { photo: attached.data }) },
    ];
    // The API needs turns to alternate, starting with the shopper.
    const alternating = turns.filter((turn, i) => i === 0 || turn.role !== turns[i - 1].role);
    setMessages((m) => [...m, { id, role: "user", text: t, photo: attached?.url, steps: [], blocks: null }, { id: id + 1, role: "agent", steps: [], blocks: null }]);
    setDraft("");
    setPhoto(null);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turns: alternating[0]?.role === "user" ? alternating : alternating.slice(1), country: market.code }) });
      if (!res.ok || !res.body) {
        const why = res.status === 429 ? "You've asked a lot this hour. Try again a little later." : res.status === 401 ? "Sign in to ask." : "I couldn't answer that just now. Try again.";
        update(id + 1, (m) => ({ ...m, error: why, blocks: [] }));
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AskEvent;
          if (event.type === "step") update(id + 1, (m) => ({ ...m, steps: [...m.steps, event.text] }));
          if (event.type === "blocks") update(id + 1, (m) => ({ ...m, blocks: event.blocks }));
          if (event.type === "error") update(id + 1, (m) => ({ ...m, error: event.message, blocks: [] }));
        }
      }
    } catch {
      update(id + 1, (m) => ({ ...m, error: "The connection dropped. Try again.", blocks: [] }));
    } finally {
      setBusy(false);
    }
  }

  // A question handed over from search ("/ask?q=…") is asked straight away, once.
  useEffect(() => {
    const q = params.get("q");
    if (q && !seeded.current && enabled && signedIn) {
      seeded.current = true;
      const t = setTimeout(() => send(q), 0);
      return () => clearTimeout(t);
    }
    // `send` is stable enough for a one-time seed; re-running on its identity would re-ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function approve(id: string, action: AskAction) {
    if (action.type === "add-to-bag") {
      for (const l of action.lines) addToCart({ slug: l.slug, title: l.title, image: l.image, option: undefined, unitPrice: l.unitPrice, qty: l.qty, note: "Suggested by Ask" });
      setActed((a) => ({ ...a, [id]: { state: "done", note: "In your bag." } }));
    }
    if (action.type === "watch") {
      setWatches([...watches.filter((w) => w.slug !== action.slug), { slug: action.slug, target: action.target, autoBuy: action.intoBag }]);
      setActed((a) => ({ ...a, [id]: { state: "done", note: action.intoBag ? "Alert set. It goes in your bag when it gets there." : "Alert set. We'll tell you when it gets there." } }));
    }
    if (action.type === "rfq") {
      const r = await openRfqAction({ item: action.item, details: action.details, slug: null, qty: action.qty, target: null, port: `${market.city}, ${market.name}`.slice(0, 80), incoterm: "DDP", samples: false });
      setActed((a) => ({ ...a, [id]: r.ok ? { state: "done", note: `Sent to ${r.rfq.shops} ${r.rfq.shops === 1 ? "shop" : "shops"}. Quotes land in Business.` } : { state: "failed", note: r.message } }));
    }
  }

  const canAsk = enabled && signedIn;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[760px] flex-col">
      <header className="pt-safe sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/75 px-3.5 pb-3 backdrop-blur-2xl lg:pt-4">
        <Link href="/search" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <AgentOrb className="size-10" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg leading-tight font-bold">Ask {brand.name}</h1>
          <p className="truncate text-xs text-ink-2">Your shopping assistant · nothing happens without your OK</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              fetch("/api/ask", { method: "DELETE" }).catch(() => {});
            }}
            disabled={busy} className="glass-inset h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold">
            New chat
          </button>
        )}
      </header>

      <div aria-live="polite" className="flex flex-1 flex-col gap-4 px-3.5 pt-5 pb-40">
        {messages.length === 0 && <Welcome onPick={send} enabled={enabled} signedIn={signedIn} />}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto flex max-w-[82%] flex-col items-end gap-1.5 motion-safe:animate-rise">
              {m.photo && <Image src={m.photo} alt="Your photo" width={180} height={180} unoptimized className="size-[180px] rounded-[22px] rounded-br-md object-cover" />}
              <p className="rounded-[22px] rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <AgentOrb className="mt-0.5 size-7 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Steps steps={m.steps} done={m.blocks !== null} />
                {m.error && <p className="text-[15px] leading-relaxed text-ink-2">{m.error}</p>}
                {m.blocks?.map((b, i) => (
                  <div key={i} className="motion-safe:animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
                    <Block block={b} state={b.kind === "action" ? acted[b.id] : undefined} onApprove={approve} onSkip={(id) => setActed((a) => ({ ...a, [id]: { state: "skipped" } }))} />
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
        <div ref={end} className="scroll-mb-[150px]" />
      </div>

      {canAsk && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="edge-bottom pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[760px] flex-wrap items-end gap-2 px-3.5 pt-6 lg:left-[256px]"
        >
          {photoError && (
            <p role="alert" className="w-full text-center text-xs text-ink-2">
              That file isn&apos;t a photo we can read.
            </p>
          )}
          {photo ? (
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove the photo" className="relative size-12 shrink-0 overflow-hidden rounded-full ring-1 ring-white/25">
              <Image src={photo.url} alt="" fill unoptimized sizes="48px" className="object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/45">
                <Icon name="close" className="size-5" />
              </span>
            </button>
          ) : (
            <label className="glass grid size-12 shrink-0 cursor-pointer place-items-center rounded-full">
              <span className="sr-only">Add a photo</span>
              <Icon name="camera" className="size-5" />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setPhotoError(false);
                  try {
                    setPhoto(await photoFromFile(file));
                  } catch {
                    setPhotoError(true);
                  }
                }}
              />
            </label>
          )}
          <label className="glass flex min-h-12 min-w-0 flex-1 items-center gap-1 rounded-[26px] pr-1 pl-4">
            <span className="sr-only">Message the assistant</span>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder={photo ? "Anything to add?" : "Describe what you need…"} enterKeyHint="send" className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
            <button type="button" onClick={() => setVoice(true)} aria-label="Speak" className="grid size-10 shrink-0 place-items-center rounded-full">
              <Icon name="mic" className="size-5" />
            </button>
          </label>
          <button type="submit" disabled={(!draft.trim() && !photo) || busy} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent transition-opacity disabled:opacity-40">
            <Icon name="send" className="size-5" />
          </button>
        </form>
      )}
      {voice && <VoiceSearch open onClose={() => setVoice(false)} onResult={send} />}
    </div>
  );
}

export function AgentOrb({ className = "size-10" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative grid place-items-center rounded-full bg-[conic-gradient(from_200deg,#c9b6ff,#ff7a52,#7fe0b4,#4da3ff,#c9b6ff)] p-[2px] ${className}`}>
      <span className="grid size-full place-items-center rounded-full bg-canvas/80">
        <Icon name="sparkle" className="size-1/2 text-agent" />
      </span>
    </span>
  );
}

function Welcome({ onPick, enabled, signedIn }: { onPick: (q: string) => void; enabled: boolean; signedIn: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5 pt-6 text-center">
      <AgentOrb className="size-20 motion-safe:animate-breathe" />
      <div>
        <h2 className="font-display text-[26px] font-bold tracking-[-0.02em]">What are you shopping for?</h2>
        <p className="mt-1 text-sm text-ink-2">I search the catalog, compare, estimate the cost to your door, and get things ready. You approve anything that goes in your bag or to a shop.</p>
      </div>
      <ul className="grid w-full grid-cols-2 gap-2 text-left">
        {[
          ["search", "Find and compare"],
          ["globe", "Price it to your door"],
          ["bell", "Set price alerts"],
          ["factory", "Ask shops for quotes"],
        ].map(([icon, label]) => (
          <li key={label} className="glass-inset flex items-center gap-2.5 rounded-2xl px-3 py-3 text-[13px] font-semibold">
            <Icon name={icon as "search"} className="size-5 text-agent" />
            {label}
          </li>
        ))}
      </ul>
      {!enabled ? (
        <p className="glass-inset w-full rounded-[20px] p-4 text-sm text-ink-2">
          Ask isn&apos;t switched on yet.{" "}
          <Link href="/search" className="font-semibold text-ink underline underline-offset-2">
            Search the catalog
          </Link>{" "}
          in the meantime.
        </p>
      ) : !signedIn ? (
        <Link href="/signin?next=/ask" className="grid h-12 w-full place-items-center rounded-full bg-accent text-[15px] font-bold">
          Sign in to ask
        </Link>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {askSuggestions.map((s) => (
            <button key={s} type="button" onClick={() => onPick(s)} className="glass flex min-h-12 items-center gap-3 rounded-[20px] px-4 py-2.5 text-left text-[15px]">
              <Icon name="sparkle" className="size-4 shrink-0 text-agent" />
              <span className="flex-1">{s}</span>
              <Icon name="forward" className="size-4 text-ink-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Steps({ steps, done }: { steps: string[]; done: boolean }) {
  const shown = steps.length ? steps : done ? [] : ["Thinking"];
  return (
    <ol className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      {shown.map((s, i) => (
        <li key={`${i}-${s}`} className="flex items-center gap-2 motion-safe:animate-rise">
          {done || i < shown.length - 1 ? <Icon name="check" className="size-4 text-positive" /> : <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />}
          {s}
        </li>
      ))}
    </ol>
  );
}

function Block({ block, state, onApprove, onSkip }: { block: AskBlock; state?: ActionState; onApprove: (id: string, a: AskAction) => void; onSkip: (id: string) => void }) {
  const money = useMoney();
  const [working, setWorking] = useState(false);

  if (block.kind === "text") return <p className="text-[15px] leading-relaxed whitespace-pre-line">{block.text}</p>;

  if (block.kind === "products")
    return (
      <ul className="no-scrollbar -mr-3.5 flex gap-2.5 overflow-x-auto pr-3.5">
        {block.products.map((p) => (
          <li key={p.slug} className="w-[160px] shrink-0">
            <ProductCard product={p} sizes="160px" />
          </li>
        ))}
      </ul>
    );

  if (block.kind === "landed")
    return (
      <div className="glass-inset rounded-[22px] p-4">
        <p className="text-sm font-semibold">
          {block.qty.toLocaleString("en-US")} × {block.title}
        </p>
        <p className="text-xs text-ink-2">Estimated to {block.country}</p>
        <dl className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-2">
          {(
            [
              ["Items", block.item],
              ["Shipping", block.shipping],
              ["Import duty", block.duty],
              ["VAT / GST", block.vat],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt>{k}</dt>
              <dd className="text-ink">{v === 0 && k === "Shipping" ? "Free" : money(v)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
            <dt>At your door, about</dt>
            <dd>{money(block.total)}</dd>
          </div>
        </dl>
      </div>
    );

  if (block.kind === "compare")
    return (
      <div className="glass-inset overflow-x-auto rounded-[22px]">
        <table className="w-full min-w-[320px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-20" />
              {block.products.map((p) => (
                <th key={p.slug} scope="col" className="p-2.5 text-left align-top font-semibold">
                  <Link href={`/p/${p.slug}`} className="flex flex-col gap-1.5">
                    <Image src={p.images[0]} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-xl object-cover" />
                    <span className="line-clamp-2 leading-snug">{p.title}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="p-2.5 text-left align-top text-xs font-semibold text-ink-3">
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className="p-2.5 align-top leading-snug">
                    {v}
                    {r.best === i && block.products.length > 1 && (
                      <span className="mt-1 flex w-fit items-center gap-0.5 rounded-full bg-positive/15 px-1.5 py-px text-[10px] font-bold text-positive">
                        <Icon name="check" className="size-3" />
                        Best
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <Link href={`/compare?ids=${block.products.map((p) => p.slug).join(",")}`} className="flex items-center gap-2 border-t border-line p-3 text-[13px] font-semibold text-agent">
          <Icon name="compare" className="size-4" />
          Open the full comparison
          <Icon name="forward" className="ml-auto size-4" />
        </Link>
      </div>
    );

  if (block.kind === "action") {
    const done = state?.state === "done";
    return (
      <div className={`rounded-[22px] p-4 ${done ? "bg-positive/10 ring-1 ring-positive/30" : "glass"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? "bg-positive/20 text-positive" : "bg-agent/15 text-agent"}`}>
            <Icon name={done ? "check" : block.action.type === "add-to-bag" ? "bag" : block.action.type === "watch" ? "bell" : "factory"} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{done ? state.note : block.label}</p>
            <p className="text-xs text-ink-2">{state?.state === "skipped" ? "Skipped. Ask me again any time." : state?.state === "failed" ? state.note : block.detail}</p>
          </div>
        </div>
        {!state && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={working}
              onClick={async () => {
                setWorking(true);
                await onApprove(block.id, block.action);
                setWorking(false);
              }}
              className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-60"
            >
              {working ? "Working…" : "Approve"}
            </button>
            <button type="button" onClick={() => onSkip(block.id)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
              Not now
            </button>
          </div>
        )}
        {done && block.action.type === "add-to-bag" && (
          <Link href="/checkout" className="mt-3 flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            Review and pay
          </Link>
        )}
        {done && block.action.type === "rfq" && (
          <Link href="/business" className="mt-3 flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            See your requests
          </Link>
        )}
      </div>
    );
  }
  return null;
}
