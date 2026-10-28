"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { ListingView, SellerView, StorefrontView } from "@/modules/catalog";
import type { QuestionView } from "@/modules/content";
import { SHIP_WITHIN_DAYS, type SellerOrderView } from "@/modules/ordering";
import { compact } from "@/lib/format";
import { CARRIERS } from "@/modules/ordering";
import { answerQuestionAction, shipAction } from "@/server/actions/shop";
import { SellerMoney, type ShopMoney } from "./seller-money";
import { StorefrontForm } from "./storefront-form";

type Tab = "listings" | "orders" | "questions" | "money" | "shop";

type Props = {
  seller: SellerView;
  storefront: StorefrontView | null;
  listings: ListingView[];
  orders: SellerOrderView[];
  questions: (QuestionView & { at: string })[];
  money: ShopMoney;
  /** Open quote requests this shop hasn't answered. */
  newRequests?: number;
  /** Blind boxes in each order: which figure to send. */
  boxes?: Record<string, { seriesTitle: string; caseNumber: number; index: number; figure: { name: string; secret: boolean } }[]>;
};

const STATUS: Record<ListingView["status"], string> = { active: "Live", draft: "Draft", archived: "Archived", removed: "Removed by moderators", suspended: "Shop suspended" };

const PARCEL: Record<string, { label: string; tone: string }> = {
  none: { label: "Paid", tone: "bg-positive/15 text-positive" },
  awaiting_shipment: { label: "To ship", tone: "bg-accent/20 text-accent-light" },
  shipped: { label: "Shipped", tone: "bg-agent/15 text-agent" },
  delivered: { label: "Delivered · paid", tone: "bg-positive/15 text-positive" },
  disputed: { label: "Problem reported", tone: "bg-save/15 text-save" },
  refunded: { label: "Refunded", tone: "bg-white/10 text-ink-2" },
};

/** Everything a shop runs on: listings, orders, buyers' questions and the storefront. */
export function SellerDashboard({ seller, storefront, listings, orders, questions, money: funds, newRequests = 0, boxes = {} }: Props) {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "listings");
  const money = useMoney();
  const paid = orders.filter((o) => o.status === "paid" || o.status === "completed");
  const toShip = orders.filter((o) => o.shipment?.status === "awaiting_shipment" || o.shipment?.status === "disputed");
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "listings", label: "Listings" },
    { id: "orders", label: "Orders", badge: toShip.length || undefined },
    { id: "questions", label: "Q&A", badge: questions.length || undefined },
    { id: "money", label: "Money" },
    { id: "shop", label: "Shop" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex items-center gap-3 rounded-[24px] p-3">
        <Image src={seller.avatar} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{seller.name}</p>
          <p className="text-xs text-ink-2">
            {listings.filter((l) => l.status === "active").length} live · {paid.length} paid {paid.length === 1 ? "order" : "orders"} · {money(paid.reduce((n, o) => n + o.subtotal, 0))} sold
          </p>
        </div>
        <Link href="/sell/live" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-live/90 px-3.5 text-[13px] font-bold">
          <Icon name="live" className="size-4" />
          Go live
        </Link>
        <Link href="/sell/quotes" aria-label={newRequests ? `Quote requests, ${newRequests} new` : "Quote requests"} className="glass-inset relative grid size-9 shrink-0 place-items-center rounded-full">
          <Icon name="factory" className="size-4" />
          {newRequests > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{newRequests}</span>}
        </Link>
        <Link href="/sell/inbox" aria-label="Messages from buyers" className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
          <Icon name="chat" className="size-4" />
        </Link>
        <Link href={`/s/${seller.id}`} aria-label="View shop" className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
          <Icon name="store" className="size-4" />
        </Link>
      </div>

      <div role="tablist" aria-label="Seller tools" className="glass grid grid-cols-5 rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative h-9 rounded-full text-[12.5px] font-semibold ${tab === t.id ? "bg-white/15 text-ink" : "text-ink-2"}`}
          >
            {t.label}
            {t.badge !== undefined && <span className="absolute -top-1 -right-0.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "listings" && (
        <section aria-label="Listings" className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Link href="/sell/listings/new" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold">
              <Icon name="plus" className="size-5" />
              New listing
            </Link>
            <Link href="/sell/ads" className="glass-inset flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold">
              <Icon name="bolt" className="size-5" />
              Promote
            </Link>
          </div>
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
                      {l.status === "removed" && l.moderationNote && <span className="block text-xs text-like">Removed: {l.moderationNote}</span>}
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
                  <span className={`rounded-full px-2 py-0.5 font-bold ${PARCEL[o.shipment?.status ?? "none"].tone}`}>{o.status === "awaiting_payment" ? "Awaiting payment" : PARCEL[o.shipment?.status ?? "none"].label}</span>
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
                {o.kind === "deposit" && (
                  <p className="mt-2.5 rounded-2xl bg-white/[0.05] p-3 text-[13px] leading-snug text-ink-2">
                    A deposit toward a pre-order. Nothing to ship: it reaches your balance when the buyer&apos;s balance order is delivered, or if they let the balance window pass.
                  </p>
                )}
                {boxes[o.id]?.length ? (
                  <p className="mt-2.5 rounded-2xl bg-white/[0.05] p-3 text-[13px] leading-snug">
                    <span className="mb-0.5 block text-[11px] font-semibold text-ink-3">Blind boxes: send these figures, sealed</span>
                    {boxes[o.id].map((b) => `${b.figure.name}${b.figure.secret ? " (secret)" : ""}, box ${b.index + 1} of case #${b.caseNumber}`).join(" · ")}
                  </p>
                ) : null}
                {o.gift && (
                  <div className="mt-2.5 rounded-2xl bg-like/10 p-3 text-[13px] leading-snug">
                    <span className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-like">
                      <Icon name="gift" className="size-3.5" />
                      Gift for {o.gift.recipientName}
                      {o.gift.waiting ? " · waiting for their address" : ""}
                    </span>
                    {o.gift.message && <span className="block">Print on the card: “{o.gift.message}”</span>}
                    {o.gift.hidePrice && <span className="block text-ink-2">Leave prices and invoices out of the parcel.</span>}
                    {o.gift.chooseOption && (
                      <span className="block text-ink-2">
                        {o.gift.chooseOption}: {o.gift.choice ?? "they're choosing"}
                      </span>
                    )}
                  </div>
                )}
                {o.address && o.shipment?.status === "awaiting_shipment" && (
                  <address className="mt-2.5 rounded-2xl bg-white/[0.05] p-3 text-[13px] leading-snug not-italic">
                    <span className="mb-0.5 block text-[11px] font-semibold text-ink-3">
                      Ship to
                      {o.paidAt && <> · by {new Date(new Date(o.paidAt).getTime() + SHIP_WITHIN_DAYS * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, or it&apos;s refunded</>}
                    </span>
                    <b className="font-semibold">{o.address.name}</b> · {o.address.phone}
                    <br />
                    {o.address.line1}
                    {o.address.line2 && `, ${o.address.line2}`}
                    <br />
                    {[o.address.city, o.address.region, o.address.postcode].filter(Boolean).join(", ")}, {o.country}
                  </address>
                )}
                {o.shipment?.status === "awaiting_shipment" && o.status === "paid" && o.address && <ShipForm orderId={o.id} />}
                {o.shipment?.tracking && (
                  <p className="mt-2 text-xs text-ink-2">
                    {o.shipment.carrier} · <span className="font-mono">{o.shipment.tracking}</span>
                  </p>
                )}
                {o.shipment?.status === "disputed" && <p className="mt-2 rounded-2xl bg-save/10 p-2.5 text-xs text-ink-2">The buyer reported a problem. The payment is held while our team looks; a quick reply to the buyer helps.</p>}
                {o.shipment?.resolution && <p className="mt-2 text-xs text-ink-2">Decision: {o.shipment.resolution.note}</p>}
              </article>
            ))
          )}
        </section>
      )}

      {tab === "questions" && <QuestionInbox questions={questions} listings={listings} />}

      {tab === "money" && <SellerMoney money={funds} />}

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

/** Carrier and tracking number: the buyer sees them at once and Protect starts its clock. */
function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<string>(CARRIERS[0]);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await shipAction(orderId, carrier, tracking);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <select aria-label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="glass-inset h-11 w-32 shrink-0 rounded-2xl px-3 text-sm outline-none">
          {CARRIERS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          aria-label="Tracking number"
          value={tracking}
          onChange={(e) => setTracking(e.target.value.toUpperCase())}
          placeholder="Tracking number"
          className="glass-inset h-11 min-w-0 flex-1 rounded-2xl px-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-ink-3"
        />
      </div>
      <button type="button" disabled={busy || tracking.trim().length < 6} onClick={send} className="h-11 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
        {busy ? "Saving…" : "Mark as shipped"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-like">
          {error}
        </p>
      )}
    </div>
  );
}
