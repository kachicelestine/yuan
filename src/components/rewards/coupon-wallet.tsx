"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { coupons } from "@/lib/account";
import { getSeller, type Coupon } from "@/lib/catalog";

/** Claimed coupons, and the ones you can still claim. Checkout applies the best one for you. */
export function CouponWallet() {
  const { coupons: wallet, claimCoupon } = useStore();
  const mine = coupons.filter((c) => wallet.includes(c.id));
  const open = coupons.filter((c) => !wallet.includes(c.id));

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/rewards" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-[-0.03em]">Coupons</h1>
          <p className="text-xs text-ink-2">The best one is applied at checkout automatically.</p>
        </div>
      </header>

      <h2 className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">IN YOUR WALLET · {mine.length}</h2>
      <ul className="flex flex-col gap-2.5">
        {mine.map((c) => (
          <li key={c.id}>
            <CouponCard coupon={c} />
          </li>
        ))}
        {!mine.length && <li className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No coupons yet. Claim one below or earn coins in Rewards.</li>}
      </ul>

      <h2 className="mt-6 mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">FREE TO CLAIM</h2>
      <ul className="flex flex-col gap-2.5">
        {open.map((c) => (
          <li key={c.id}>
            <CouponCard coupon={c} onClaim={() => void claimCoupon(c.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A ticket-style coupon with a perforated edge. */
export function CouponCard({ coupon: c, onClaim, compact }: { coupon: Coupon; onClaim?: () => void; compact?: boolean }) {
  const money = useMoney();
  const seller = c.sellerId ? getSeller(c.sellerId) : undefined;
  const headline = couponHeadline(c, money);
  return (
    <div className="relative flex overflow-hidden rounded-[22px] bg-[linear-gradient(110deg,rgb(204_58_23/0.28),rgb(255_197_61/0.12))] ring-1 ring-white/12">
      <div className={`flex w-[38%] shrink-0 flex-col justify-center border-r border-dashed border-white/25 ${compact ? "px-3 py-2.5" : "px-4 py-4"}`}>
        <span className={`font-display leading-none font-extrabold tracking-[-0.02em] ${compact ? "text-lg" : "text-2xl"}`}>{headline}</span>
        <span className="mt-1 text-[11px] text-ink-2">over {money(c.minSpend, { nice: true })}</span>
      </div>
      <div className={`flex min-w-0 flex-1 items-center gap-3 ${compact ? "px-3 py-2.5" : "px-4 py-4"}`}>
        {seller && <Image src={seller.avatar} alt="" width={32} height={32} sizes="32px" className="size-8 shrink-0 rounded-full object-cover" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{seller ? seller.name : "Any seller"}</span>
          <span className="block text-[11px] text-ink-2">Ends {c.expires}</span>
        </span>
        {onClaim && (
          <button type="button" onClick={onClaim} className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-black">
            Claim
          </button>
        )}
      </div>
      <span aria-hidden="true" className="absolute top-1/2 left-[38%] size-4 -translate-x-1/2 -translate-y-[calc(50%+40px)] rounded-full bg-canvas" />
    </div>
  );
}

/** A seller's coupon offered right where you buy: claim it in one tap. */
export function SellerCouponChip({ sellerId }: { sellerId: string }) {
  const money = useMoney();
  const { coupons: wallet, claimCoupon } = useStore();
  const coupon = coupons.find((c) => c.sellerId === sellerId);
  if (!coupon) return null;
  const owned = wallet.includes(coupon.id);
  const headline = couponHeadline(coupon, money);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-[linear-gradient(110deg,rgb(204_58_23/0.25),rgb(255_197_61/0.1))] px-3 py-2 ring-1 ring-white/10">
      <Icon name="card" className="size-5 shrink-0 text-accent-light" />
      <span className="min-w-0 flex-1 text-[13px]">
        <b className="font-semibold">{headline}</b>
        <span className="text-ink-2"> over {money(coupon.minSpend, { nice: true })} · ends {coupon.expires}</span>
      </span>
      <button
        type="button"
        onClick={() => !owned && void claimCoupon(coupon.id)}
        aria-pressed={owned}
        className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold ${owned ? "bg-positive/15 text-positive" : "bg-white text-black"}`}
      >
        {owned ? "Claimed" : "Claim"}
      </button>
    </div>
  );
}

/** What a coupon is worth, in the shopper's currency: "₦33,000 off", "10% off", "Free express". */
export function couponHeadline(c: Coupon, money: ReturnType<typeof useMoney>) {
  return c.freeShipping ? "Free express" : c.percent ? `${Math.round(c.value * 100)}% off` : `${money(c.value, { nice: true })} off`;
}
