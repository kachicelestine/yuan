"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { ListingView, SellerView, StorefrontView } from "@/modules/catalog";
import type { QuestionView } from "@/modules/content";
import type { SellerOrderView } from "@/modules/ordering";
import { compact } from "@/lib/format";
import { answerQuestionAction } from "@/server/actions/shop";
import { StorefrontForm } from "./storefront-form";

type Tab = "listings" | "orders" | "questions" | "shop";

type Props = {
  seller: SellerView;
  storefront: StorefrontView | null;
  listings: ListingView[];
  orders: SellerOrderView[];
  questions: (QuestionView & { at: string })[];
};

const STATUS: Record<ListingView["status"], string> = { active: "Live", draft: "Draft", archived: "Archived" };

/** Everything a shop runs on: listings, orders, buyers' questions and the storefront. */
export function SellerDashboard({ seller, storefront, listings, orders, questions }: Props) {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "listings");
  const money = useMoney();
  const paid = orders.filter((o) => o.status === "paid");
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "listings", label: "Listings" },
    { id: "orders", label: "Orders", badge: paid.length || undefined },
    { id: "questions", label: "Questions", badge: questions.length || undefined },
    { id: "shop", label: "Shop" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex items-center gap-3 rounded-[24px] p-3">
        <Image src={seller.avatar} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{seller.name}</p>
          <p className="text-xs text-ink-2">
            {listings.filter((l) => l.status === "active").length} live · {paid.length} paid orders · {money(paid.reduce((n, o) => n + o.subtotal, 0))} sold
          </p>
        </div>
        <Link href={`/s/${seller.id}`} className="glass-inset h-9 shrink-0 rounded-full px-4 text-[13px] leading-9 font-semibold">
          View shop
        </Link>
      </div>

      <div role="tablist" aria-label="Seller tools" className="glass grid grid-cols-4 rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative h-9 rounded-full text-[13px] font-semibold ${tab === t.id ? "bg-white/15 text-ink" : "text-ink-2"}`}
          >
            {t.label}
            {t.badge !== undefined && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "listings" && (
        <section aria-label="Listings" className="flex flex-col gap-2">
          <Link href="/sell/listings/new" className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold">
            <Icon name="plus" className="size-5" />
            New listing
          </Link>
          {listings.length === 0 ? (
            <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No listings yet. Start with your best seller: good photos and an honest title sell more than anything else.</p>
          ) : (
            <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link href={`/sell/listings/${l.id}`} className="flex items-center gap-3 px-3 py-2.5">
                    <Image src={l.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.title}</span>
                      <span className="block text-xs text-ink-2">
                        {l.price === undefined ? "Quote" : money(l.price)} · {l.reviews ? `★ ${l.rating} · ` : ""}
                        {l.sold ? `${compact(l.sold)} sold` : "no sales yet"}
                      </span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${l.status === "active" ? "bg-positive/15 text-positive" : "bg-white/10 text-ink-2"}`}>{STATUS[l.status]}</span>
                    <Icon name="forward" className="size-4 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "orders" && (
        <section aria-label="Orders" className="flex flex-col gap-2">
          {orders.length === 0 ? (
            <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No orders yet. They show here the moment a buyer pays.</p>
          ) : (
            orders.map((o) => (
              <article key={o.id} className="glass rounded-[22px] p-3.5">
                <header className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-2">
                  <span className="font-mono font-semibold text-ink">{o.number}</span>
                  <span>
                    {new Date(o.placedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · to {o.country}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-bold ${o.status === "paid" ? "bg-positive/15 text-positive" : "bg-white/10"}`}>{o.status === "paid" ? "Paid" : "Awaiting payment"}</span>
                </header>
                <ul className="flex flex-col gap-1.5">
                  {o.lines.map((l, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <Image src={l.image} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate">
                        {l.qty} × {l.title}
                        {l.option && <span className="text-ink-3"> · {l.option}</span>}
                      </span>
                      <span className="font-semibold">{money(l.unitPrice * l.qty)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </section>
      )}

      {tab === "questions" && <QuestionInbox questions={questions} listings={listings} />}

      {tab === "shop" && <StorefrontForm seller={seller} storefront={storefront} />}
    </div>
  );
}

function QuestionInbox({ questions, listings }: { questions: Props["questions"]; listings: ListingView[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const titles = new Map(listings.map((l) => [l.slug, l.title]));
  const open = questions.filter((q) => !done.includes(q.id));

  async function send(id: string) {
    setError(null);
    const r = await answerQuestionAction(id, drafts[id] ?? "");
    if (!r.ok) return setError(r.message);
    setDone((list) => [...list, id]);
    router.refresh();
  }

  if (!open.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No questions waiting. Fast answers sell: buyers see how quickly you reply.</p>;
  return (
    <section aria-label="Questions" className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
      {open.map((q) => (
        <article key={q.id} className="glass flex flex-col gap-2 rounded-[22px] p-3.5">
          <p className="text-xs text-ink-2">
            {titles.get(q.productSlug) ?? q.productSlug} · {q.asker}
          </p>
          <p className="text-[15px] font-semibold">{q.question}</p>
          <div className="flex items-end gap-2">
            <textarea
              aria-label={`Answer: ${q.question}`}
              value={drafts[q.id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
              maxLength={1000}
              rows={2}
              className="glass-inset min-w-0 flex-1 rounded-2xl p-3 text-base outline-none"
              placeholder="Your answer is public on the listing"
            />
            <button type="button" disabled={!(drafts[q.id] ?? "").trim()} onClick={() => send(q.id)} className="h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-bold disabled:opacity-40">
              Answer
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
