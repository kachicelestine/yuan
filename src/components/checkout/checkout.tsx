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
import { addressRules } from "@/modules/ordering";
import { DEFAULT_RAIL, RAILS, type RailId } from "@/modules/payments";
import { useCoupons } from "@/components/rewards/use-coupons";
import { bestCoupon } from "@/lib/account";
import { getSeller } from "@/lib/catalog";
import { useProducts, useSimilar } from "@/components/product/use-products";
import { haptic } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import type { Rankings } from "@/lib/rankings";
import { checkoutAction } from "@/server/actions/checkout";
import { useStored } from "@/lib/use-stored";
import { BagSection, type BagGroup } from "./bag-section";

/** A company that can take the order, as /api/delivery/options prices it (dollars). */
type DeliveryChoice = {
  id: string;
  company: string;
  service: string;
  blurb: string;
  kind: string;
  handover: "door" | "pickup";
  price: number;
  days: [number, number];
  deliveredBy: string;
  estimate: boolean;
};

/** The cheapest few are shown; the rest are a tap away. */
const SHOWN = 4;

const HOLD_MS = 1200;

type Address = { name: string; phone: string; line1: string; line2: string; city: string; region: string; postcode: string };
const EMPTY_ADDRESS: Address = { name: "", phone: "", line1: "", line2: "", city: "", region: "", postcode: "" };
const SHORT: Record<keyof Address, string> = { name: "name", phone: "phone number", line1: "street", line2: "apartment", city: "city", region: "state or region", postcode: "postcode" };

/** [field, label, autocomplete, required], in the order each country's rules ask for. */
function addressFields(country: string): [keyof Address, string, string, boolean][] {
  const { postcode, region } = addressRules(country);
  return [
    ["name", "Full name", "name", true],
    ["phone", "Phone", "tel", true],
    ["line1", "Street and number", "address-line1", true],
    ["line2", "Apartment, floor or landmark", "address-line2", false],
    ["city", "City", "address-level2", true],
    ["region", region.label, "address-level1", region.required],
    ["postcode", postcode.label, "postal-code", postcode.required],
  ];
}

/** Buyers pay in dollar stablecoins, so the amount to send is always shown in USD. */
const usd = (amount: number) => formatMoney(amount, "USD");

export function Checkout({ rails: available, signedIn }: { rails: string[]; signedIn: boolean }) {
  const router = useRouter();
  const { ready, cart, setQty, addToCart, recordOrder, market, setMarket, coupons: wallet } = useStore();
  const rails = RAILS.filter((r) => available.includes(r.id));
  const money = useMoney();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [choices, setChoices] = useState<DeliveryChoice[] | null>(null);
  const [allChoices, setAllChoices] = useState(false);
  const [dutiesNow, setDutiesNow] = useState(true);
  const [picked, setPay] = useState<RailId>(DEFAULT_RAIL);
  const pay = rails.some((r) => r.id === picked) ? picked : (rails[0]?.id ?? DEFAULT_RAIL);
  const [submitting, startSubmit] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [combine, setCombine] = useState(true);
  const [later, setLater] = useStored<CartLine[]>("app.later", []);
  // Remembered on this device, so the next order is one tap.
  const [address, setAddress] = useStored<Address>("app.address", EMPTY_ADDRESS);
  const fields = addressFields(market.code);
  const missing = fields.filter(([key, , , required]) => required && !address[key]?.trim()).map(([key]) => SHORT[key]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The bag's listings from the catalog, for where each ships from, its shop and its duty rate.
  const listed = new Map(useProducts(cart.map((l) => l.slug)).products.map((p) => [p.slug, p]));
  const getProduct = (slug: string) => listed.get(slug);
  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  // Each shipping origin is a parcel; combining repacks them into one box at our hub.
  const groups = cart.reduce<BagGroup[]>((list, line) => {
    const product = getProduct(line.slug);
    const origin = product?.shipsFrom || "China";
    const seller = product ? (product.seller ?? getSeller(product.sellerId))?.name : undefined;
    const group = list.find((g) => g.origin === origin);
    if (group) {
      group.lines.push(line);
      if (seller && !group.sellers.includes(seller)) group.sellers.push(seller);
    } else list.push({ origin, sellers: seller ? [seller] : [], lines: [line] });
    return list;
  }, []);
  // Who can carry these parcels there, priced for their weight (the server charges the same).
  const bagKey = cart.map((l) => `${l.slug}×${l.qty}`).join(",");
  useEffect(() => {
    if (!ready || !cart.length) return;
    const controller = new AbortController();
    fetch("/api/delivery/options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ country: market.code, lines: cart.map((l) => ({ slug: l.slug, qty: l.qty })), combine }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ options: DeliveryChoice[] }>) : null))
      .then((r) => r && setChoices(r.options))
      .catch(() => {});
    return () => controller.abort();
    // The bag's contents are in bagKey; the cart array changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bagKey, market.code, combine]);
  const options = choices ?? [];
  const chosen = options.find((o) => o.id === deliveryId) ?? options[0] ?? null;
  // Over the free-shipping threshold the cheapest company is free; a dearer one costs the difference.
  const free = subtotal >= market.freeShippingOver;
  const shipPrice = (o: DeliveryChoice) => (free ? Math.max(0, o.price - (options[0]?.price ?? 0)) : o.price);
  const shipCost = chosen ? shipPrice(chosen) : 0;
  const fastest = options.reduce<DeliveryChoice | null>((best, o) => (!best || o.days[1] < best.days[1] ? o : best), null);
  const visible = allChoices ? options : options.filter((o, i) => i < SHOWN || o.id === chosen?.id);
  const combineSaving = 0;
  const walletCoupons = useCoupons({ ids: wallet }) ?? [];
  const coupon = bestCoupon(
    walletCoupons,
    cart.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, sellerId: getProduct(l.slug)?.sellerId })),
    shipCost,
  );
  const discount = coupon?.discount ?? 0;
  const duty = cart.reduce((sum, l) => sum + l.unitPrice * l.qty * (getProduct(l.slug)?.dutyRate ?? 0.06), 0);
  const duties = duty + (subtotal + shipCost + duty) * market.vat;
  const total = subtotal - discount + shipCost + (dutiesNow ? duties : 0);
  const railName = RAILS.find((r) => r.id === pay)?.asset ?? "USDC";
  const pairs = useSimilar(cart[0]?.slug ?? null).filter((p) => !cart.some((l) => l.slug === p.slug));

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
    if (!chosen) {
      setFailure(choices?.length === 0 ? "No carrier takes parcels this heavy. Ask the shop for a freight quote." : "Delivery prices are still loading. Try again in a moment.");
      return;
    }
    if (missing.length) {
      setFailure(`Add the ${missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0]} for the delivery.`);
      document.getElementById("ship-to")?.scrollIntoView({ behavior: "smooth", block: "center" });
      haptic([30, 60, 30]);
      return;
    }
    startSubmit(async () => {
      // The server reprices everything; what's shown here is a preview.
      const r = await checkoutAction({
        lines: cart.map((l) => ({ slug: l.slug, option: l.option ?? null, qty: l.qty })),
        country: market.code,
        address: { name: address.name, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, region: address.region, postcode: address.postcode },
        delivery: chosen.id,
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
      // Ordering confirms the country, so it's kept for next time and other devices.
      setMarket(market.code);
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
    return <EmptyBag />;
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

        {/* min-w-0: a fieldset otherwise grows to its longest line instead of wrapping it. */}
        <fieldset className="glass min-w-0 rounded-[26px] p-4">
          <legend className="sr-only">Delivery company</legend>
          <h2 aria-hidden="true" className="text-[13px] font-semibold text-ink-2">
            Delivery to {market.name}
          </h2>
          {choices === null ? (
            <div aria-label="Loading delivery companies" className="mt-3 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton block h-16 rounded-[18px]" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">No parcel carrier takes a parcel this heavy. Ask the shop for a freight quote, or split the order.</p>
          ) : (
            <>
              <p className="mt-0.5 mb-3 text-xs text-ink-3">
                {options.length === 1 ? "One company can" : `${options.length} companies can`} take this order. Pick one and the shop ships with it.
              </p>
              <div className="flex flex-col gap-2">
                {visible.map((o) => (
                  <label
                    key={o.id}
                    className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-[18px] px-3 py-2.5 transition-[background,box-shadow] ${chosen?.id === o.id ? "bg-white/15 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.85)]" : "glass-inset"}`}
                  >
                    <input type="radio" name="delivery" value={o.id} checked={chosen?.id === o.id} onChange={() => setDeliveryId(o.id)} className="size-5 shrink-0 accent-white" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <b className="text-sm font-semibold">{o.company}</b>
                        <span className="text-xs text-ink-2">{o.service}</span>
                        {o.id === options[0].id && <span className="rounded-full bg-positive/15 px-1.5 py-px text-[10px] font-bold text-positive">Cheapest</span>}
                        {o.id === fastest?.id && o.id !== options[0].id && <span className="rounded-full bg-agent/15 px-1.5 py-px text-[10px] font-bold text-agent">Fastest</span>}
                      </span>
                      <span className="block text-xs text-ink-2">
                        {o.days[0]}–{o.days[1]} days · {o.handover === "pickup" ? "collect near you" : "to your door"}
                      </span>
                      {o.deliveredBy !== o.company && <span className="block text-[11px] leading-snug text-ink-3">Delivered in {market.name} by {o.deliveredBy}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-bold">{shipPrice(o) ? money(shipPrice(o)) : "Free"}</span>
                  </label>
                ))}
              </div>
              {options.length > SHOWN && (
                <button type="button" onClick={() => setAllChoices((v) => !v)} className="mt-2.5 text-[13px] font-semibold text-agent">
                  {allChoices ? "Show fewer" : `Show all ${options.length} companies`}
                </button>
              )}
              <p className="mt-2 text-[11px] leading-snug text-ink-3">
                {options.some((o) => o.estimate) ? "Prices come from each company's published rates for these parcels' weights, and they're what you pay. " : ""}Days are working days once the shop ships; customs can add a few.
              </p>
            </>
          )}
        </fieldset>

        <section id="ship-to" aria-label="Ship to" className="glass scroll-mt-24 rounded-[26px] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-2">Ship to</h2>
          <ShipTo variant="country" className="mb-2 rounded-2xl" />
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map(([key, label, autoComplete, required]) => (
              <label key={key} className={`glass-inset flex flex-col rounded-2xl px-3.5 py-2 ${key === "line1" || key === "line2" ? "sm:col-span-2" : ""}`}>
                <span className="text-[11px] font-semibold text-ink-2">
                  {label}
                  {!required && " (optional)"}
                </span>
                <input
                  name={key}
                  autoComplete={autoComplete}
                  type={key === "phone" ? "tel" : "text"}
                  required={required}
                  maxLength={key === "phone" ? 24 : 120}
                  value={address[key] ?? ""}
                  onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
                  placeholder={key === "city" ? market.city : undefined}
                  className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3"
                />
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
          <p className="mt-2.5 text-xs text-ink-3">
            Prices are in US dollars; you pay the same amount in a dollar stablecoin. Local currency is shown for reference. By paying you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/returns" className="underline underline-offset-2">
              Returns policy
            </Link>
            .
          </p>
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

/** An empty bag suggests what's selling, from this week's rankings. */
function EmptyBag() {
  const [top, setTop] = useState<Extract<Rankings["rows"][number], { kind: "product" }>[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rankings?board=hot&period=week", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Rankings>) : null))
      .then((r) => r && setTop(r.rows.flatMap((x) => (x.kind === "product" ? [x] : [])).slice(0, 4)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
      <div className="grid min-h-dvh place-items-center pt-safe pb-safe">
        <EmptyState icon="bag" title="Your bag is empty" body="Tap Buy on anything in the feed or a live room and it lands here." primary={{ href: "/", label: "Back to the feed" }} secondary={{ href: "/rankings", label: "See what's selling" }}>
          <p className="mb-2 text-left text-xs font-bold tracking-[0.1em] text-ink-3">BEST SELLERS</p>
          <ul className="grid grid-cols-2 gap-2.5 text-left">
            {top.map((r, i) => (
                <li key={r.product.slug}>
                  <ProductCard product={r.product} eager={i < 2} sizes="(min-width: 640px) 200px, 45vw" />
                </li>
              ))}
          </ul>
        </EmptyState>
      </div>
  );
}
