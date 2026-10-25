"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon, type IconName } from "@/components/icon";
import { ShipTo } from "@/components/market/ship-to";
import { InstallCard } from "@/components/me/install-card";
import { ShipmentPill } from "@/components/orders/shipment-pill";
import { useMoney } from "@/components/price";
import type { Watch } from "@/components/product/price-history";
import { ProductTile } from "@/components/product/product-tile";
import { glassLevel, useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { demoShipment } from "@/lib/account";
import { levelOf } from "@/modules/engagement";
import { useUnread } from "@/components/shell/unread";
import { getProduct } from "@/lib/catalog";
import { useProducts } from "@/components/product/use-products";
import { plural } from "@/lib/format";
import { photo } from "@/lib/images";
import { useStored } from "@/lib/use-stored";
import type { AccountView } from "@/modules/identity";
import type { OrderView } from "@/modules/ordering";
import { signOutAction } from "@/server/actions/auth";

const statusLabel: Record<OrderView["status"], string> = { awaiting_payment: "Waiting for payment", paid: "Paid · on its way", cancelled: "Cancelled", completed: "Delivered" };

const levels = [
  { id: "clear", label: "Clear" },
  { id: "regular", label: "Regular" },
  { id: "frosted", label: "Frosted" },
  { id: "tinted", label: "Tinted" },
] as const;

/**
 * Your hub: orders on the way, money tools (rewards, coupons, watches), creator and business
 * modes, settings. `account` and `orders` come from the server; null while loading or signed out.
 */
export function MeScreen({
  account = null,
  orders = [],
  hasShop = false,
  admin = false,
  unread = 0,
  boards = null,
}: {
  account?: AccountView | null;
  orders?: OrderView[];
  /** Runs a shop: Sell opens the seller tools instead of the application. */
  hasShop?: boolean;
  admin?: boolean;
  /** Unread notifications. */
  unread?: number;
  /** How many boards the account has (null when signed out or not loaded yet). */
  boards?: number | null;
}) {
  const money = useMoney();
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();
  const { ready, saved, glass, setGlass, coins, coinsEarned, coupons: wallet, refreshAccount } = useStore();
  const [watches, setWatches] = useStored<Watch[]>("app.watches", []);
  const savedProducts = useProducts(saved).products;
  const watched = new Map(useProducts(watches.map((w) => w.slug)).products.map((p) => [p.slug, p]));
  const level = glassLevel(glass);
  const tier = levelOf(coinsEarned);
  const { chats } = useUnread();

  const tiles: { href: string; label: string; icon: IconName; note?: string; badge?: number }[] = [
    { href: `/orders/${orders[0]?.number ?? demoShipment.orderId}`, label: "Orders", icon: "truck", note: account ? plural(orders.length, "order") : "Sample" },
    { href: "/notifications", label: "Notifications", icon: "bell", badge: unread || undefined, note: account ? undefined : "Sign in" },
    { href: "/inbox", label: "Inbox", icon: "chat", badge: chats || undefined },
    { href: "/rewards", label: "Rewards", icon: "gift", note: `${coins.toLocaleString("en-US")} coins` },
    { href: "/coupons", label: "Coupons", icon: "card", note: `${wallet.length} ready` },
    { href: "/collections", label: "Collections", icon: "bookmark", note: boards === null ? "Saved" : plural(boards, "board") },
    { href: "#watches", label: "Watches", icon: "bell", note: `${watches.length} on` },
    { href: "/creator", label: "Creator", icon: "sparkle", note: "Earn" },
    { href: "/business", label: "Business", icon: "factory", note: "Bulk" },
    { href: "/sell", label: hasShop ? "Your shop" : "Sell", icon: "store", note: hasShop ? "Listings, orders" : "Open a shop" },
    ...(admin ? [{ href: "/admin", label: "Admin", icon: "shield" as IconName, note: "Reviews" }] : []),
  ];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-3.5 pt-safe pb-36 lg:px-6 lg:py-8">
      <header className="flex items-center gap-4 pt-4 lg:pt-0">
        <span className="relative grid size-16 shrink-0 place-items-center rounded-full bg-[conic-gradient(from_180deg,#ffc53d,#ff7a52,#cc3a17,#ffc53d)] p-[3px]">
          <span className="grid size-full place-items-center rounded-full bg-raised">
            <Icon name="user" className="size-7" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.03em]">{account ? "Hi again" : "Hi there"}</h1>
          <p className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
            <span className="shrink-0 rounded-full bg-save/15 px-2 py-0.5 text-[11px] font-bold text-save">{tier.name}</span>
            <span className="truncate">{account ? account.label : "Guest on this device"}</span>
          </p>
        </div>
        {account ? (
          <button
            type="button"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                await signOutAction();
                await refreshAccount();
                router.refresh();
              })
            }
            className="glass-inset h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold text-ink-2"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        ) : (
          <Link href="/signin?next=/me" className="glass h-10 shrink-0 rounded-full px-4 text-[13px] leading-10 font-semibold">
            Sign in
          </Link>
        )}
      </header>

      <ShipmentPill demo className="self-start" />

      <nav aria-label="Your account" className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="glass-inset relative flex flex-col items-center gap-1.5 rounded-[22px] px-1 py-3 text-center">
            <Icon name={t.icon} className="size-6" />
            <span className="text-[12.5px] leading-tight font-semibold">{t.label}</span>
            {t.note && <span className="text-[10.5px] leading-tight text-ink-3">{t.note}</span>}
            {t.badge ? <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold">{t.badge}</span> : null}
          </Link>
        ))}
      </nav>

      <InstallCard />

      <ShipTo variant="row" />

      <section aria-labelledby="orders" className="glass rounded-[28px] p-4">
        <h2 id="orders" className="mb-3 text-[17px] font-bold">
          Orders
        </h2>
        <ul className="flex flex-col divide-y divide-line">
          {[
            ...orders.map((o) => ({ id: o.number, total: o.totals.total, images: o.lines.map((l) => l.image), status: statusLabel[o.status], count: o.lines.reduce((n, l) => n + l.qty, 0) })),
            {
              id: demoShipment.orderId,
              total: demoShipment.total,
              images: demoShipment.lines.map((l) => getProduct(l.slug)?.images[0] ?? ""),
              status: `Sample · ${demoShipment.steps[demoShipment.stage].label.toLowerCase()}`,
              count: demoShipment.lines.reduce((n, l) => n + l.qty, 0),
            },
          ].map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="flex items-center gap-3 py-3 first:pt-0">
                <div className="flex -space-x-3">
                  {order.images.slice(0, 3).map((src, i) => (
                    <Image key={`${src}-${i}`} src={src} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-xl object-cover ring-2 ring-surface" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold whitespace-nowrap">Order {order.id}</p>
                  <p className="truncate text-xs text-ink-2">
                    {plural(order.count, "item")} · {order.status}
                  </p>
                </div>
                <span className="font-display font-bold">{money(order.total)}</span>
                <Icon name="forward" className="size-4 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
        {!account && (
          <Link href="/signin?next=/me" className="mt-2 flex items-center justify-between rounded-2xl bg-white/[0.06] px-3 py-2.5 text-[13px] font-semibold">
            Sign in to see your orders
            <Icon name="forward" className="size-4 text-ink-3" />
          </Link>
        )}
      </section>

      <section id="watches" aria-labelledby="watches-h" className="glass scroll-mt-6 rounded-[28px] p-4">
        <h2 id="watches-h" className="text-[17px] font-bold">
          Price watches
        </h2>
        <p className="mb-3 text-[13px] text-ink-2">We tell you when a price hits your target, and can put it in your bag.</p>
        {watches.length === 0 ? (
          <p className="text-sm text-ink-2">
            None yet. Set one on any product page, or{" "}
            <Link href="/ask?q=Tell%20me%20if%20the%20power%20station%20drops%20under%20%24540" className="font-semibold text-ink underline">
              ask the assistant
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {watches.map((w) => {
              const p = watched.get(w.slug);
              if (!p) return null;
              return (
                <li key={w.slug} className="flex items-center gap-3 py-3">
                  <Image src={p.images[0]} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-xl object-cover" />
                  <Link href={`/p/${p.slug}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-ink-2">
                      Now {money(p.price ?? 0)} · target {money(w.target)}
                    </span>
                  </Link>
                  {w.autoBuy && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10.5px] font-bold text-accent-light">To bag</span>}
                  <button type="button" onClick={() => setWatches(watches.filter((x) => x.slug !== w.slug))} aria-label={`Stop watching ${p.title}`} className="grid size-9 place-items-center rounded-full text-ink-3">
                    <Icon name="close" className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="appearance" className="glass flex flex-col gap-4 rounded-[28px] p-4">
        <div>
          <h2 id="appearance" className="text-[17px] font-bold">
            Liquid Glass
          </h2>
          <p className="text-[13px] text-ink-2">From clear to tinted, like the iOS 27 setting. It changes every bar and sheet in {brand.name}.</p>
        </div>
        <div className="relative h-36 overflow-hidden rounded-[22px]">
          <Image src={photo("1612919914128-48ac089b951d", { ar: "16:9" })} alt="" fill sizes="(min-width: 768px) 700px, 100vw" className="object-cover" />
          <div className="glass glass-bar absolute top-1/2 left-1/2 flex h-14 w-64 -translate-x-1/2 -translate-y-1/2 items-center justify-around rounded-full">
            <Icon name="home" />
            <span className="glass-selected grid h-11 w-14 place-items-center rounded-full">
              <Icon name="compass" />
            </span>
            <Icon name="live" />
            <Icon name="user" />
          </div>
        </div>
        <label htmlFor="glass" className="sr-only">
          Glass strength
        </label>
        <input id="glass" type="range" min={0} max={100} value={glass} onChange={(e) => setGlass(Number(e.target.value))} aria-valuetext={level} className="h-11 w-full cursor-pointer accent-white" />
        <div className="-mt-3 grid grid-cols-4 text-center text-xs font-semibold">
          {levels.map((l) => (
            <span key={l.id} className={l.id === level ? "text-ink" : "text-ink-3"}>
              {l.label}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="saved">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 id="saved" className="text-[17px] font-bold">
            Saved
          </h2>
          <Link href="/collections" className="text-[13px] font-semibold text-ink-2">
            All boards
          </Link>
        </div>
        {ready && saved.length === 0 ? (
          <p className="px-1 text-sm text-ink-2">Tap Save in the shop sheet under any video to keep it here.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {savedProducts.map((p) => (
              <li key={p.slug}>
                <ProductTile product={p} sizes="(min-width: 640px) 240px, 50vw" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
