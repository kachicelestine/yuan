"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { ShipTo } from "@/components/market/ship-to";
import { useMoney } from "@/components/price";
import { ProductCard } from "@/components/product/product-card";
import { useStore, type CartLine } from "@/components/providers";
import { couponHeadline } from "@/components/rewards/coupon-wallet";
import { DEFAULT_RAIL, RAILS, type RailId } from "@/modules/payments";
import { bestCoupon } from "@/lib/account";
import { getProduct, getSeller, similarProducts } from "@/lib/catalog";
import { haptic } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import { rankProducts } from "@/lib/rankings";
import { checkoutAction } from "@/server/actions/checkout";
import { useStored } from "@/lib/use-stored";
import { BagSection, type BagGroup } from "./bag-section";

const shipping = [
  { id: "standard", label: "Standard", detail: "Sea-air, tracked door to door", eta: "7–12 days", extra: 0 },
  { id: "express", label: "Express", detail: "Air courier, signature on delivery", eta: "3–5 days", extra: 18 },
] as const;


const HOLD_MS = 1200;

/** Buyers pay in dollar stablecoins, so the amount to send is always shown in USD. */
const usd = (amount: number) => formatMoney(amount, "USD");

export function Checkout({ rails: available, signedIn }: { rails: string[]; signedIn: boolean }) {
  const router = useRouter();
  const { ready, cart, setQty, addToCart, recordOrder, market, coupons: wallet } = useStore();
  const rails = RAILS.filter((r) => available.includes(r.id));
  const money = useMoney();
  const [ship, setShip] = useState<(typeof shipping)[number]["id"]>("standard");
  const [dutiesNow, setDutiesNow] = useState(true);
  const [picked, setPay] = useState<RailId>(DEFAULT_RAIL);
  const pay = rails.some((r) => r.id === picked) ? picked : (rails[0]?.id ?? DEFAULT_RAIL);
  const [submitting, startSubmit] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [combine, setCombine] = useState(true);
  const [later, setLater] = useStored<CartLine[]>("app.later", []);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  // Each shipping origin is a parcel; combining repacks them into one box at our hub.
  const groups = cart.reduce<BagGroup[]>((list, line) => {
    const product = getProduct(line.slug);
    const origin = product?.shipsFrom ?? "China";
    const seller = product ? getSeller(product.sellerId)?.name : undefined;
    const group = list.find((g) => g.origin === origin);
    if (group) {
      group.lines.push(line);
      if (seller && !group.sellers.includes(seller)) group.sellers.push(seller);
    } else list.push({ origin, sellers: seller ? [seller] : [], lines: [line] });
    return list;
  }, []);
  const parcels = combine ? 1 : Math.max(groups.length, 1);
  const baseShipping = subtotal >= market.freeShippingOver ? 0 : market.shipping;
  const perParcel = (id: (typeof shipping)[number]["id"]) => baseShipping + (shipping.find((s) => s.id === id)?.extra ?? 0);
  const shipPrice = (id: (typeof shipping)[number]["id"]) => perParcel(id) * parcels;
  const shipCost = shipPrice(ship);
  const combineSaving = perParcel(ship) * (groups.length - 1);
  const coupon = bestCoupon(wallet, cart, shipCost);
  const discount = coupon?.discount ?? 0;
  const duty = cart.reduce((sum, l) => sum + l.unitPrice * l.qty * (getProduct(l.slug)?.dutyRate ?? 0.06), 0);
  const duties = duty + (subtotal + shipCost + duty) * market.vat;
  const total = subtotal - discount + shipCost + (dutiesNow ? duties : 0);
  const railName = RAILS.find((r) => r.id === pay)?.asset ?? "USDC";
  const firstProduct = cart[0] ? getProduct(cart[0].slug) : undefined;
  const pairs = firstProduct ? similarProducts(firstProduct, 6).filter((p) => !cart.some((l) => l.slug === p.slug)) : [];

  function saveForLater(line: CartLine) {
    setLater([...later.filter((l) => l.key !== line.key), line]);
    setQty(line.key, 0);
  }

  function moveBack(line: CartLine) {
    setLater(later.filter((l) => l.key !== line.key));
    addToCart({ slug: line.slug, title: line.title, image: line.image, option: line.option, unitPrice: line.unitPrice, qty: line.qty, note: line.note });
  }

  function complete() {
    if (submitting) return;
    setHolding(false);
    setFailure(null);
    startSubmit(async () => {
      // The server reprices everything; what's shown here is a preview.
      const r = await checkoutAction({
        lines: cart.map((l) => ({ slug: l.slug, option: l.option ?? null, qty: l.qty })),
        country: market.code,
        shippingMethod: ship,
        combineParcels: combine,
        payDutiesNow: dutiesNow,
        couponId: coupon?.coupon.id ?? null,
        rail: pay,
      });
      if (!r.ok) {
        if (r.code === "sign_in_required") return router.push("/signin?next=/checkout");
        setFailure(r.message);
        haptic([30, 60, 30]);
        return;
      }
      haptic([12, 40, 24]);
      recordOrder({ id: r.orderNumber, total: r.total });
      // Deals and stale bags can change the price; tell the buyer if the server's total differs.
      router.push(`/pay/${r.invoiceId}${Math.abs(r.total - total) >= 0.01 ? "?updated=1" : ""}`);
    });
  }

  function startHold() {
    if (!cart.length || submitting) return;
    setHolding(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(complete, HOLD_MS);
  }

  function cancelHold() {
    clearTimeout(timer.current);
    setHolding(false);
  }

  if (ready && cart.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center pt-safe pb-safe">
        <EmptyState icon="bag" title="Your bag is empty" body="Tap Buy on anything in the feed or a live room and it lands here." primary={{ href: "/", label: "Back to the feed" }} secondary={{ href: "/rankings", label: "See what's selling" }}>
          <p className="mb-2 text-left text-xs font-bold tracking-[0.1em] text-ink-3">SELLING FAST THIS WEEK</p>
          <ul className="grid grid-cols-2 gap-2.5 text-left">
            {rankProducts("hot", "week")
              .slice(0, 4)
              .map((r) => (
                <li key={r.product.slug}>
                  <ProductCard product={r.product} sizes="(min-width: 640px) 200px, 45vw" />
                </li>
              ))}
          </ul>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pt-safe pb-40">
      <header className="flex h-[60px] items-center gap-3">
        <Link href="/" aria-label="Back" className="glass grid size-12 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-[28px] font-extrabold tracking-[-0.025em]">Checkout</h1>
        <span className="glass flex h-[34px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
          <Icon name="lock" className="size-[15px] text-positive" />
          Secure
        </span>
      </header>

      <div className="mt-3 flex flex-col gap-3">
        <BagSection
          groups={groups}
          count={cart.reduce((n, l) => n + l.qty, 0)}
          subtotal={subtotal}
          freeOver={market.freeShippingOver}
          combine={combine}
          onCombine={setCombine}
          combineSaving={combineSaving}
          onQty={setQty}
          onLater={saveForLater}
          coupon={coupon}
          later={later}
          onMoveBack={moveBack}
          pairs={pairs}
        />

        <fieldset className="glass rounded-[26px] p-4">
          <legend className="sr-only">Delivery</legend>
          <h2 aria-hidden="true" className="mb-3 text-[13px] font-semibold text-ink-2">
            Delivery
          </h2>
          <div className="flex flex-col gap-2">
            {shipping.map((option) => (
              <label
                key={option.id}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2 transition-[background,box-shadow] ${ship === option.id ? "bg-white/15 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.85)]" : "glass-inset"}`}
              >
                <input type="radio" name="ship" value={option.id} checked={ship === option.id} onChange={() => setShip(option.id)} className="size-5 accent-white" />
                <span className="flex-1">
                  <b className="block text-sm font-semibold">
                    {option.label}, {option.eta}
                  </b>
                  <span className="text-xs text-ink-2">{option.detail}</span>
                </span>
                <span className="text-sm font-bold">{shipPrice(option.id) ? money(shipPrice(option.id)) : "Free"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-label="Ship to" className="glass rounded-[26px] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-2">Ship to</h2>
          <ShipTo variant="row" className="mb-2 rounded-2xl" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["name", "Full name", "name"],
              ["phone", "Phone", "tel"],
              ["street", "Street and number", "street-address"],
              ["city", "City", "address-level2"],
            ].map(([id, label, autoComplete]) => (
              <label key={id} className={`glass-inset flex flex-col rounded-2xl px-3.5 py-2 ${id === "street" ? "sm:col-span-2" : ""}`}>
                <span className="text-[11px] font-semibold text-ink-2">{label}</span>
                <input name={id} autoComplete={autoComplete} placeholder={id === "city" ? market.city : undefined} className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3" />
              </label>
            ))}
          </div>
        </section>

        <section aria-label="Duties and taxes" className="glass rounded-[26px] p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <span className="flex-1">
              <b className="block text-sm font-semibold">Pay duties{market.vat ? ` and ${market.vatLabel}` : ""} now</b>
              <span className="text-xs text-ink-2">
                {dutiesNow ? `${money(duties)} included. Nothing to pay at your door.` : `The courier collects about ${money(duties)} on delivery.`}
              </span>
            </span>
            <span className="relative inline-flex">
              <input type="checkbox" role="switch" checked={dutiesNow} onChange={(e) => setDutiesNow(e.target.checked)} className="peer sr-only" />
              <span className="h-8 w-[52px] rounded-full bg-white/20 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-white" />
              <span className="absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-500 ease-spring peer-checked:translate-x-5" />
            </span>
          </label>
        </section>

        <fieldset className="glass rounded-[26px] p-4">
          <legend className="sr-only">Pay with</legend>
          <h2 aria-hidden="true" className="mb-3 text-[13px] font-semibold text-ink-2">
            Pay with
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {rails.map((rail) => (
              <label
                key={rail.id}
                className={`flex min-h-[78px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 text-center transition-[background,box-shadow] has-focus-visible:ring-2 has-focus-visible:ring-white ${pay === rail.id ? "bg-white/15 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.85)]" : "glass-inset"}`}
              >
                <input type="radio" name="pay" value={rail.id} checked={pay === rail.id} onChange={() => setPay(rail.id)} className="sr-only" />
                <b className="font-display text-[15px] font-bold">{rail.asset}</b>
                <span className="text-xs font-semibold text-ink-2">on {rail.network}</span>
                <span className="text-[10.5px] text-ink-3">fee {rail.fee}</span>
              </label>
            ))}
          </div>
          <p className="mt-2.5 text-xs text-ink-3">Prices are in US dollars; you pay the same amount in a dollar stablecoin. Local currency is shown for reference.</p>
        </fieldset>

        <section aria-label="Order summary" className="glass rounded-[26px] p-4 text-sm">
          <dl className="flex flex-col gap-1.5 text-ink-2">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="font-semibold text-ink">{money(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt>Coupon · {coupon && couponHeadline(coupon.coupon, money)}</dt>
                <dd className="font-semibold text-positive">−{money(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Shipping{groups.length > 1 ? (combine ? " · one box" : ` · ${groups.length} parcels`) : ""}</dt>
              <dd className="font-semibold text-ink">{shipCost ? money(shipCost) : "Free"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Duties{market.vat ? ` and ${market.vatLabel}` : ""}</dt>
              <dd className="font-semibold text-ink">{dutiesNow ? money(duties) : "On delivery"}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-[15px] font-semibold">Total</span>
            <span className="text-right">
              <span className="block font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{usd(total)}</span>
              {market.currency !== "USD" && <span className="block text-xs text-ink-3">about {money(total)}</span>}
            </span>
          </div>
          {failure && (
            <p role="alert" className="mt-3 rounded-2xl bg-like/12 p-3 text-[13px] text-like">
              {failure}
            </p>
          )}
        </section>
      </div>

      <div className="glass bottom-safe fixed inset-x-3 z-30 mx-auto max-w-[620px] rounded-full p-2">
        {!signedIn ? (
          <Link href="/signin?next=/checkout" className="flex h-[60px] w-full items-center justify-center gap-2 rounded-full bg-accent text-base font-bold">
            <Icon name="user" className="size-5" />
            Sign in to pay {usd(total)}
          </Link>
        ) : (
        <button
          type="button"
          aria-label={`Press and hold to pay ${usd(total)} in ${railName}`}
          disabled={submitting}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              complete();
            }
          }}
          className="relative flex h-[60px] w-full touch-none items-center justify-center gap-2 overflow-hidden rounded-full bg-white/10 text-base font-bold select-none"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: holding ? "100%" : "22%", transition: holding ? `width ${HOLD_MS}ms linear` : "width 0.3s ease" }}
          />
          <span className="relative flex items-center gap-2">
            <Icon name="lock" className="size-5" />
            {submitting ? "Placing your order…" : holding ? "Keep holding…" : `Hold to pay ${usd(total)} · ${railName}`}
          </span>
        </button>
        )}
      </div>
    </div>
  );
}

