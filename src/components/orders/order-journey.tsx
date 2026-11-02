"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useMoney } from "@/components/price";
import { useProducts } from "@/components/product/use-products";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { shiftDelivery } from "@/lib/landed";
import { trackingLink } from "@/modules/delivery";
import { AUTO_CONFIRM_DAYS, type GiftSummary, type OrderView, type ShipmentView } from "@/modules/ordering";
import { GiftPanel } from "./gift-panel";
import { OrderParcels } from "./order-parcels";

/** Where your order is, from the shop to your door, with Protect holding the money until you're happy. */
export function OrderJourney({
  placed,
  parcels = [],
  shops = {},
  reviewed = [],
  gift = null,
  invoiceId = null,
}: {
  placed: OrderView;
  /** One per shop once the order is paid. */
  parcels?: ShipmentView[];
  shops?: Record<string, { name: string; avatar: string }>;
  reviewed?: string[];
  /** When the order is a gift the buyer sent. */
  gift?: GiftSummary | null;
  /** The payment to finish, while it's awaiting payment. */
  invoiceId?: string | null;
}) {
  const { markets, market: home } = useStore();
  const money = useMoney();
  const market = markets.find((m) => m.code === placed.country) ?? home;
  const [first] = useProducts(placed.lines.slice(0, 1).map((l) => l.slug)).products;
  const eta = first ? shiftDelivery(first.delivery, market.extraDays) : null;
  const paid = placed.status === "paid" || placed.status === "completed";
  const items = placed.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">Order {placed.number}</h1>
          <p className="text-xs text-ink-2">
            {items} {items === 1 ? "item" : "items"} · {money(placed.totals.total)}
          </p>
        </div>
      </header>

      {placed.status === "awaiting_payment" && (
        <section aria-label="Payment" className="glass flex flex-col gap-3 rounded-[26px] p-4">
          <p className="flex items-start gap-2.5 text-[13px]">
            <Icon name="clock" className="mt-0.5 size-5 shrink-0 text-save" />
            <span>
              <b className="font-semibold">Waiting for your payment.</b> The shops start packing as soon as it arrives. Unpaid orders are cancelled when the payment window closes.
            </span>
          </p>
          {invoiceId && (
            <Link href={`/pay/${invoiceId}`} className="grid h-12 place-items-center rounded-full bg-accent text-[15px] font-bold">
              Pay now
            </Link>
          )}
        </section>
      )}

      {placed.status === "cancelled" && (
        <p role="status" className="glass flex items-start gap-2.5 rounded-[26px] p-4 text-[13px]">
          <Icon name="close" className="mt-0.5 size-5 shrink-0 text-ink-2" />
          <span>
            <b className="font-semibold">Cancelled.</b> The payment didn&apos;t arrive in time, so nothing was taken. If you paid late, the order reopens by itself once the payment shows up.
          </span>
        </p>
      )}

      {paid && parcels.length > 0 && <ParcelProgress parcels={parcels} eta={eta} from={first?.shipsFrom || "China"} to={market.name} toCode={market.code} delivery={placed.delivery} />}

      {paid && (
        <section aria-labelledby="protect-h" className="glass mt-5 rounded-[26px] p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-positive/15 text-positive">
              <Icon name="shield" />
            </span>
            <div>
              <h2 id="protect-h" className="text-[15px] font-bold">
                {money(placed.totals.total)} held by {brand.name} Protect
              </h2>
              <p className="text-[13px] text-ink-2">
                {placed.kind === "deposit" ? (
                  <>
                    This is a deposit: nothing ships yet. It counts toward the balance, which you pay when its window opens (we&apos;ll tell you), and reaches the shop when that order is delivered. If the shop cancels, it comes back to you; if the balance window passes unpaid, it goes to the shop.{" "}
                    <Link href="/drops#deposits" className="font-semibold text-ink underline underline-offset-2">
                      See your pre-orders
                    </Link>
                  </>
                ) : (
                  <>
                    Each shop is paid when you confirm its parcel arrived, or {AUTO_CONFIRM_DAYS} days after it ships if you don&apos;t report a problem. Report one and the money stays put until it&apos;s sorted.
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {gift && <GiftPanel gift={gift} paid={paid} country={placed.country} />}
      {paid && parcels.length > 0 && <OrderParcels order={placed} parcels={parcels} shops={shops} reviewed={reviewed} />}

      {(!paid || parcels.length === 0) && (
        <section aria-labelledby="items-h" className="mt-5">
          <h2 id="items-h" className="mb-3 px-1 text-[15px] font-bold">
            In this order
          </h2>
          <ul className="glass flex flex-col divide-y divide-line rounded-[26px] px-4">
            {placed.lines.map((l, i) => (
              <li key={`${l.slug}-${i}`}>
                <Link href={`/p/${l.slug}`} className="flex items-center gap-3 py-3">
                  <Image src={l.image} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.title}</span>
                    <span className="block text-xs text-ink-2">
                      {l.option ? `${l.option} · ` : ""}× {l.qty}
                    </span>
                  </span>
                  <span className="font-display text-sm font-bold">{money(l.unitPrice * l.qty)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/inbox/${placed.lines[0]?.sellerId}?about=${placed.lines[0]?.slug}`} className="glass-inset mt-3 flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold">
            <Icon name="chat" className="size-4" />
            Message the shop
          </Link>
        </section>
      )}
    </div>
  );
}

const STAGES = ["Paid", "Shipped", "Delivered"] as const;

/** A paid order's progress, from its parcels: packing, on the way, delivered. */
function ParcelProgress({ parcels, eta, from, to, toCode, delivery }: { parcels: ShipmentView[]; eta: string | null; from: string; to: string; toCode: string; delivery: OrderView["delivery"] }) {
  const settled = parcels.every((p) => p.status === "delivered" || p.status === "refunded");
  const moving = parcels.some((p) => p.status === "shipped" || p.status === "delivered");
  const stage = settled ? 2 : moving ? 1 : 0;
  const disputed = parcels.some((p) => p.status === "disputed");
  const sent = parcels.find((p) => p.tracking);
  const headline = settled ? "Delivered" : (eta ?? "On its way");
  const status = disputed ? "Problem reported · payment held" : settled ? "Every parcel arrived" : moving ? `${parcels.filter((p) => p.tracking).length} of ${parcels.length} shipped` : "The shops are packing";

  return (
    <section aria-label="Delivery" className="glass relative overflow-hidden rounded-[30px] p-5">
      <p className="text-xs font-semibold text-ink-2">{settled ? "Status" : eta ? "Usually arrives" : "Status"}</p>
      <p className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em]">{headline}</p>
      <p className="mt-1 flex items-center gap-2 text-sm">
        <span className={`size-2.5 rounded-full ${disputed ? "bg-save" : "bg-positive"}`} />
        <b className="font-semibold">{status}</b>
      </p>
      {delivery && (
        <p className="mt-1 text-xs text-ink-2">
          {delivery.company} · {delivery.service}, {delivery.days[0]}–{delivery.days[1]} working days
          {delivery.deliveredBy !== delivery.company ? ` · delivered by ${delivery.deliveredBy}` : ""}
        </p>
      )}
      <div className="mt-6">
        <div className="flex justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Flag code="CN" className="size-4" />
            {from}
          </span>
          <span className="flex items-center gap-1.5">
            {to}
            <Flag code={toCode} className="size-4" />
          </span>
        </div>
        <div className="relative mt-3 h-1 rounded-full bg-white/10" role="progressbar" aria-label="Delivery" aria-valuenow={stage * 50} aria-valuemin={0} aria-valuemax={100}>
          <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-light" style={{ width: `${stage * 50}%` }} />
        </div>
        <ol className="mt-2 flex justify-between text-[11px] font-semibold">
          {STAGES.map((label, i) => (
            <li key={label} className={i <= stage ? "text-ink" : "text-ink-3"}>
              {label}
            </li>
          ))}
        </ol>
        {sent && (
          <p className="mt-3 flex items-center justify-between text-xs text-ink-2">
            <span>{sent.carrier}</span>
            <a href={trackingLink(sent.carrier ?? "", sent.tracking ?? "")} target="_blank" rel="noopener noreferrer" className="font-mono underline decoration-white/30 underline-offset-2">
              {sent.tracking}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
