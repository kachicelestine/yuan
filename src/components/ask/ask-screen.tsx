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
import { agentSuggestions, respond, type AgentAction, type AgentBlock } from "@/lib/agent";
import { getProduct, getSeller, unitPrice } from "@/lib/catalog";
import { landedCost } from "@/lib/landed";
import { useStored } from "@/lib/use-stored";

type Message = { id: number; role: "user" | "agent"; text?: string; blocks?: AgentBlock[]; ready?: boolean };
export type Rfq = { id: string; item: string; qty: number; sellerIds: string[]; sentAt: string };

const STEP_MS = 520;

/** "Ask": a shopping agent that finds, compares, prices and acts, with your approval. */
export function AskScreen() {
  const params = useSearchParams();
  const { markets, market, addToCart } = useStore();
  const money = useMoney();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState(false);
  const [approved, setApproved] = useState<Record<string, "done" | "skipped">>({});
  const [watches, setWatches] = useStored<Watch[]>("app.watches", []);
  const [rfqs, setRfqs] = useStored<Rfq[]>("app.rfqs", []);
  const end = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const nextId = useRef(1);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    const blocks = respond(t, market, money, markets);
    const id = nextId.current;
    nextId.current += 2;
    setMessages((m) => [...m, { id, role: "user", text: t }, { id: id + 1, role: "agent", blocks, ready: false }]);
    setDraft("");
    const steps = blocks.find((b) => b.kind === "steps");
    const delay = steps && steps.kind === "steps" ? steps.steps.length * STEP_MS + 250 : 500;
    setTimeout(() => setMessages((m) => m.map((msg) => (msg.id === id + 1 ? { ...msg, ready: true } : msg))), delay);
  }

  // A question handed over from search ("/ask?q=…") is asked straight away, once.
  useEffect(() => {
    const q = params.get("q");
    if (q && !seeded.current) {
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

  function approve(id: string, action: AgentAction) {
    if (action.type === "add-to-bag") {
      for (const line of action.lines) {
        const p = getProduct(line.slug);
        if (p) addToCart({ slug: p.slug, title: p.title, image: p.images[0], unitPrice: unitPrice(p, line.qty), qty: line.qty, note: "Picked by your agent" });
      }
    }
    if (action.type === "watch") {
      setWatches([...watches.filter((w) => w.slug !== action.slug), { slug: action.slug, target: action.target, autoBuy: action.autoBuy }]);
    }
    if (action.type === "rfq") {
      setRfqs([{ id: `RFQ-${rfqs.length + 101}`, item: action.item, qty: action.qty, sellerIds: action.sellerIds, sentAt: "Just now" }, ...rfqs]);
    }
    setApproved((a) => ({ ...a, [id]: "done" }));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[760px] flex-col">
      <header className="pt-safe sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/75 px-3.5 pb-3 backdrop-blur-2xl lg:pt-4">
        <Link href="/search" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <AgentOrb className="size-10" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg leading-tight font-bold">Ask {brand.name}</h1>
          <p className="truncate text-xs text-ink-2">Your shopping agent · nothing is bought without your OK</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setMessages([])} className="glass-inset h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold">
            New chat
          </button>
        )}
      </header>

      <div aria-live="polite" className="flex flex-1 flex-col gap-4 px-3.5 pt-5 pb-40">
        {messages.length === 0 && <Welcome onPick={send} />}
        {messages.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="ml-auto max-w-[82%] rounded-[22px] rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-snug motion-safe:animate-rise">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <AgentOrb className="mt-0.5 size-7 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {m.blocks?.map((b, i) =>
                  b.kind === "steps" ? (
                    <Steps key={i} steps={b.steps} done={!!m.ready} />
                  ) : m.ready ? (
                    <div key={i} className="motion-safe:animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
                      <Block block={b} state={b.kind === "action" ? approved[b.id] : undefined} onApprove={approve} onSkip={(id) => setApproved((a) => ({ ...a, [id]: "skipped" }))} />
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          ),
        )}
        <div ref={end} className="scroll-mb-[150px]" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="edge-bottom pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[760px] items-end gap-2 px-3.5 pt-6 lg:left-[256px]"
      >
        <label className="glass flex min-h-12 min-w-0 flex-1 items-center gap-1 rounded-[26px] pr-1 pl-4">
          <span className="sr-only">Message your agent</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Describe what you need…"
            enterKeyHint="send"
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
          />
          <button type="button" onClick={() => setVoice(true)} aria-label="Speak" className="grid size-10 shrink-0 place-items-center rounded-full">
            <Icon name="mic" className="size-5" />
          </button>
        </label>
        <button type="submit" disabled={!draft.trim()} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent transition-opacity disabled:opacity-40">
          <Icon name="send" className="size-5" />
        </button>
      </form>
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

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-5 pt-6 text-center">
      <AgentOrb className="size-20 motion-safe:animate-breathe" />
      <div>
        <h2 className="font-display text-[26px] font-bold tracking-[-0.02em]">What are you shopping for?</h2>
        <p className="mt-1 text-sm text-ink-2">I search every factory, compare, price it to your door and do the legwork. You approve anything that spends money.</p>
      </div>
      <ul className="grid w-full grid-cols-2 gap-2 text-left">
        {[
          ["search", "Find and compare"],
          ["globe", "Price it to your door"],
          ["bell", "Watch and auto-buy"],
          ["factory", "Get factory quotes"],
        ].map(([icon, label]) => (
          <li key={label} className="glass-inset flex items-center gap-2.5 rounded-2xl px-3 py-3 text-[13px] font-semibold">
            <Icon name={icon as "search"} className="size-5 text-agent" />
            {label}
          </li>
        ))}
      </ul>
      <div className="flex w-full flex-col gap-2">
        {agentSuggestions.map((s) => (
          <button key={s} type="button" onClick={() => onPick(s)} className="glass flex min-h-12 items-center gap-3 rounded-[20px] px-4 py-2.5 text-left text-[15px]">
            <Icon name="sparkle" className="size-4 shrink-0 text-agent" />
            <span className="flex-1">{s}</span>
            <Icon name="forward" className="size-4 text-ink-3" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Steps({ steps, done }: { steps: string[]; done: boolean }) {
  return (
    <ol className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 opacity-0 motion-safe:animate-rise motion-reduce:opacity-100" style={{ animationDelay: `${i * STEP_MS}ms`, animationFillMode: "both" }}>
          {done || i < steps.length - 1 ? (
            <Icon name="check" className="size-4 text-positive" />
          ) : (
            <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          )}
          {s}
        </li>
      ))}
    </ol>
  );
}

function Block({ block, state, onApprove, onSkip }: { block: AgentBlock; state?: "done" | "skipped"; onApprove: (id: string, a: AgentAction) => void; onSkip: (id: string) => void }) {
  const money = useMoney();
  const { market } = useStore();

  if (block.kind === "text") return <p className="text-[15px] leading-relaxed">{block.text}</p>;

  if (block.kind === "products")
    return (
      <ul className="no-scrollbar -mr-3.5 flex gap-2.5 overflow-x-auto pr-3.5">
        {block.slugs.map((slug) => {
          const p = getProduct(slug);
          return p ? (
            <li key={slug} className="w-[160px] shrink-0">
              <ProductCard product={p} sizes="160px" />
            </li>
          ) : null;
        })}
      </ul>
    );

  if (block.kind === "landed") {
    const p = getProduct(block.slug);
    if (!p) return null;
    const l = landedCost(unitPrice(p, block.qty) * block.qty, p.dutyRate, market);
    return (
      <div className="glass-inset rounded-[22px] p-4">
        <div className="flex items-center gap-3">
          <Image src={p.images[0]} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {block.qty} × {p.title}
            </p>
            <p className="text-xs text-ink-2">
              To {market.city}, {market.name}
            </p>
          </div>
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-2">
          {[
            ["Items", l.item],
            ["Shipping", l.shipping],
            [`Import duty (${Math.round(p.dutyRate * 100)}%)`, l.duty],
            ...(market.vat ? [[`${market.vatLabel} (${Math.round(market.vat * 100)}%)`, l.vat] as [string, number]] : []),
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <dt>{k}</dt>
              <dd className="text-ink">{(v as number) === 0 && k === "Shipping" ? "Free" : money(v as number)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
            <dt>At your door</dt>
            <dd>{money(l.total)}</dd>
          </div>
        </dl>
        <Link href={`/p/${p.slug}`} className="mt-3 flex h-10 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold">
          Open product
        </Link>
      </div>
    );
  }

  if (block.kind === "kit") {
    const total = block.lines.reduce((n, l) => n + (getProduct(l.slug)?.price ?? 0) * l.qty, 0);
    return (
      <ul className="glass-inset flex flex-col divide-y divide-line overflow-hidden rounded-[22px]">
        {block.lines.map((l) => {
          const p = getProduct(l.slug);
          return p ? (
            <li key={l.slug}>
              <Link href={`/p/${p.slug}`} className="flex items-center gap-3 p-3">
                <Image src={p.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {l.qty} × {p.title}
                  </span>
                  <span className="block text-xs leading-snug text-ink-2">{l.why}</span>
                </span>
                <span className="font-display text-sm font-bold">{money((p.price ?? 0) * l.qty)}</span>
              </Link>
            </li>
          ) : null;
        })}
        <li className="flex justify-between p-3 text-sm font-bold">
          <span>Kit total, before duties</span>
          <span className="font-display">{money(total)}</span>
        </li>
        <li>
          <Link href="/energy" className="flex items-center gap-2 p-3 text-[13px] font-semibold text-agent">
            <Icon name="sun" className="size-4" />
            Fine-tune it in the kit builder
            <Icon name="forward" className="ml-auto size-4" />
          </Link>
        </li>
      </ul>
    );
  }

  if (block.kind === "compare") {
    const items = block.slugs.map((s) => getProduct(s)).filter(Boolean);
    return (
      <div className="glass-inset overflow-x-auto rounded-[22px]">
        <table className="w-full min-w-[320px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-20" />
              {items.map((p) => (
                <th key={p!.slug} scope="col" className="p-2.5 text-left align-top font-semibold">
                  <Link href={`/p/${p!.slug}`} className="flex flex-col gap-1.5">
                    <Image src={p!.images[0]} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-xl object-cover" />
                    <span className="line-clamp-2 leading-snug">{p!.title}</span>
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
                    {r.best === i && (
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
        <Link href={`/compare?ids=${block.slugs.join(",")}`} className="flex items-center gap-2 border-t border-line p-3 text-[13px] font-semibold text-agent">
          <Icon name="compare" className="size-4" />
          Open the full comparison
          <Icon name="forward" className="ml-auto size-4" />
        </Link>
      </div>
    );
  }

  if (block.kind === "action") {
    const doneText =
      block.action.type === "add-to-bag"
        ? "Added to your bag."
        : block.action.type === "watch"
          ? "Watching. I'll buy it at your price and message you."
          : `Sent. ${block.action.sellerIds.map((id) => getSeller(id)?.name).join(", ")} will reply in your inbox.`;
    return (
      <div className={`rounded-[22px] p-4 ${state === "done" ? "bg-positive/10 ring-1 ring-positive/30" : "glass"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-positive/20 text-positive" : "bg-agent/15 text-agent"}`}>
            <Icon name={state === "done" ? "check" : block.action.type === "add-to-bag" ? "bag" : block.action.type === "watch" ? "bell" : "factory"} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{state === "done" ? doneText : block.label}</p>
            <p className="text-xs text-ink-2">{state === "skipped" ? "Skipped. Ask me again any time." : block.detail}</p>
          </div>
        </div>
        {!state && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => onApprove(block.id, block.action)} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold">
              Approve
            </button>
            <button type="button" onClick={() => onSkip(block.id)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
              Not now
            </button>
          </div>
        )}
        {state === "done" && block.action.type === "add-to-bag" && (
          <Link href="/checkout" className="mt-3 flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
            Review and pay
          </Link>
        )}
      </div>
    );
  }
  return null;
}

