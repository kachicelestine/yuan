"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Watch } from "@/components/product/price-history";
import { announceAdd, haptic } from "@/lib/feedback";
import { unpackMarkets, type PackedMarket } from "@/lib/markets-wire";
import type { Market } from "@/lib/types";
import { removeStored, useStored, writeStored } from "@/lib/use-stored";
import { cartKey, type CartItem } from "@/modules/ordering";
import type { AccountState } from "@/server/account-data";
import { checkInAction, claimCouponAction, redeemRewardAction, syncAccountAction } from "@/server/actions/account";

/** Ship-to country for first-time visitors, until they pick one. */
const DEFAULT_MARKET = "US";

export type CartLine = {
  key: string;
  slug: string;
  title: string;
  image: string;
  option?: string;
  unitPrice: number;
  qty: number;
  /** Price locked in from a live room or deal, shown as a tag at checkout. */
  note?: string;
};

export type Order = { id: string; placedAt: string; total: number; lines: CartLine[] };

export type Checkin = { streak: number; claimedToday: boolean };

type Account = { id: string };

type Store = {
  ready: boolean;
  cart: CartLine[];
  cartCount: number;
  addToCart: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  clearCart: () => void;
  orders: Order[];
  /** Remembers an order the server placed (a shortcut for the shipment pill) and empties the bag. */
  recordOrder: (order: { id: string; total: number }) => Order;
  saved: string[];
  toggleSaved: (slug: string) => void;
  /** Products with a price-drop alert switched on. */
  alerts: string[];
  toggleAlert: (slug: string) => void;
  /** Usable coupon ids in the wallet. */
  coupons: string[];
  /** Claims a free coupon; kept on the device until the shopper signs in. */
  claimCoupon: (id: string) => Promise<void>;
  /** Coins and check-ins need an account: signed out, both are zero. */
  coins: number;
  checkin: Checkin;
  /** Coins earned, or null when signed out. */
  checkIn: () => Promise<number | null>;
  redeem: (rewardId: string) => Promise<{ ok: true } | { ok: false; message: string; signIn: boolean }>;
  /** The signed-in account once this device has synced with it; null when signed out. */
  account: Account | null;
  /** Checks who's signed in and syncs this device with that account. Call after signing in or out. */
  refreshAccount: () => Promise<void>;
  /** Every country we deliver to, loaded from the database by the root layout. */
  markets: Market[];
  /** Ship-to country; sets display currency, taxes and delivery times everywhere. */
  market: Market;
  setMarket: (code: string) => void;
  /** 0 = clear, 100 = tinted, the iOS 27 Liquid Glass slider. */
  glass: number;
  setGlass: (value: number) => void;
};

const StoreContext = createContext<Store | null>(null);

const KEYS = {
  cart: "app.cart",
  orders: "app.orders",
  saved: "app.saved",
  alerts: "app.alerts",
  market: "app.market",
  glass: "app.glass",
  watches: "app.watches",
  coupons: "app.coupons",
  coins: "app.coins",
  checkin: "app.checkin",
  /** Which account this device's copy belongs to. */
  owner: "app.account",
  /** Edits made while signed in that the account hasn't confirmed yet (e.g. offline). */
  unsaved: "app.account-unsaved",
} as const;

/** What signing out forgets: the account keeps it, and the next person on this device shouldn't see it. */
const ACCOUNT_KEYS = [KEYS.cart, KEYS.orders, KEYS.saved, KEYS.alerts, KEYS.watches, KEYS.coupons, KEYS.coins, KEYS.checkin, KEYS.owner, KEYS.unsaved];

const NO_CHECKIN: Checkin = { streak: 0, claimedToday: false };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the session still works, it just won't persist.
  }
}

const toggled = (list: string[], slug: string) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);

const toItem = (l: CartLine): CartItem => ({ slug: l.slug, option: l.option ?? null, qty: l.qty, note: l.note ?? null });

type DeviceCopy = { cart: CartLine[]; saved: string[]; alerts: string[]; watches: Watch[] };

/** The part of the device's copy the shopper edits freely, in the shape the account stores. */
const deviceData = (d: DeviceCopy) => ({ cart: d.cart.map(toItem), saved: d.saved, alerts: d.alerts, watches: d.watches });

/** Bags saved before lines were keyed by product and option alone get folded together. */
function rekey(lines: CartLine[]): CartLine[] {
  const byKey = new Map<string, CartLine>();
  for (const l of lines) {
    const key = cartKey({ slug: l.slug, option: l.option ?? null });
    const prev = byKey.get(key);
    byKey.set(key, prev ? { ...prev, qty: prev.qty + l.qty } : { ...l, key });
  }
  return [...byKey.values()];
}

export function glassLevel(value: number) {
  if (value < 20) return "clear";
  if (value < 55) return "regular";
  if (value < 80) return "frosted";
  return "tinted";
}

export function StoreProvider({ markets: packed, children }: { markets: PackedMarket[]; children: React.ReactNode }) {
  const markets = useMemo(() => unpackMarkets(packed), [packed]);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [marketCode, setMarketCode] = useState(DEFAULT_MARKET);
  const [glass, setGlassState] = useState(45);
  const [account, setAccount] = useState<Account | null>(null);
  const [watches] = useStored<Watch[]>(KEYS.watches, []);
  const [coupons, setCoupons] = useStored<string[]>(KEYS.coupons, ["welcome5"]);
  const [coins] = useStored<number>(KEYS.coins, 0);
  const [checkin] = useStored<Checkin>(KEYS.checkin, NO_CHECKIN);

  // The device data as of the last render, for sync code that runs outside it.
  const latest = useRef({ cart, saved, alerts, watches, coupons });
  useEffect(() => {
    latest.current = { cart, saved, alerts, watches, coupons };
  });
  /** The data the account is known to hold, serialized; edits are anything else. */
  const confirmed = useRef<string | null>(null);

  const applyAccount = useCallback((state: AccountState) => {
    const lines: CartLine[] = state.cart.map((l) => ({ key: l.key, slug: l.slug, title: l.title, image: l.image, option: l.option, unitPrice: l.unitPrice, qty: l.qty, note: l.note }));
    setCart(lines);
    setSaved(state.saved);
    setAlerts(state.alerts);
    write(KEYS.saved, state.saved);
    write(KEYS.alerts, state.alerts);
    writeStored(KEYS.watches, state.watches);
    writeStored(KEYS.coupons, state.coupons);
    writeStored(KEYS.coins, state.coins);
    writeStored(KEYS.checkin, state.checkin);
    write(KEYS.owner, state.accountId);
    confirmed.current = JSON.stringify(deviceData({ cart: lines, saved: state.saved, alerts: state.alerts, watches: state.watches }));
  }, []);

  const forgetAccount = useCallback(() => {
    ACCOUNT_KEYS.forEach(removeStored);
    setCart([]);
    setOrders([]);
    setSaved([]);
    setAlerts([]);
    confirmed.current = null;
  }, []);

  const refreshAccount = useCallback(async () => {
    let body: { signedIn: false } | { signedIn: true; state: AccountState };
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (!res.ok) return;
      body = await res.json();
    } catch {
      return; // Offline: keep working from this device's copy.
    }
    const owner = read<string | null>(KEYS.owner, null);
    if (!body.signedIn) {
      if (owner) forgetAccount();
      setAccount(null);
      return;
    }
    let state = body.state;
    // Someone else's copy (they signed out elsewhere): it's safe on their account; drop it here.
    if (owner && owner !== state.accountId) forgetAccount();
    if (!owner) {
      // First time this device sees the account: the bag and lists made while signed out join it.
      const merged = await syncAccountAction({ mode: "merge", data: { ...deviceData(latest.current), coupons: latest.current.coupons } });
      if (merged.ok && merged.state) state = merged.state;
    } else if (owner === state.accountId && read(KEYS.unsaved, false)) {
      // Edits made offline: this device's copy is newer than the account's, so it's saved over it.
      const r = await syncAccountAction({ mode: "save", data: deviceData(latest.current) });
      if (r.ok) {
        removeStored(KEYS.unsaved);
        const d = latest.current;
        state = { ...state, saved: d.saved, alerts: d.alerts, watches: d.watches, cart: d.cart.map((l) => ({ ...l, option: l.option, note: l.note })) };
      }
    }
    applyAccount(state);
    setAccount({ id: state.accountId });
  }, [applyAccount, forgetAccount]);

  useEffect(() => {
    // Browser storage is only available after mount; read it once, then mark ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(rekey(read(KEYS.cart, [])));
    setOrders(read(KEYS.orders, []));
    setSaved(read(KEYS.saved, []));
    setAlerts(read(KEYS.alerts, []));
    setMarketCode(read(KEYS.market, DEFAULT_MARKET));
    setGlassState(read(KEYS.glass, 45));
    setReady(true);
  }, []);

  useEffect(() => {
    // After the local copy is on screen, catch up with the account (if any).
    if (ready) startTransition(() => refreshAccount());
  }, [ready, refreshAccount]);

  useEffect(() => {
    document.documentElement.dataset.glass = glassLevel(glass);
  }, [glass]);

  useEffect(() => {
    if (ready) write(KEYS.cart, cart);
  }, [cart, ready]);

  // Signed in, edits are saved to the account shortly after they stop.
  useEffect(() => {
    if (!account) return;
    const data = deviceData({ cart, saved, alerts, watches });
    const serialized = JSON.stringify(data);
    if (serialized === confirmed.current) return;
    write(KEYS.unsaved, true);
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await syncAccountAction({ mode: "save", data });
        if (r.ok) {
          confirmed.current = serialized;
          if (JSON.stringify(deviceData(latest.current)) === serialized) removeStored(KEYS.unsaved);
        } else if (r.code === "signed_out") {
          await refreshAccount();
        }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [account, cart, saved, alerts, watches, refreshAccount]);

  const addToCart = useCallback((line: Omit<CartLine, "key">) => {
    announceAdd(line.image);
    haptic(12);
    const key = cartKey({ slug: line.slug, option: line.option ?? null });
    setCart((lines) => {
      const existing = lines.find((l) => l.key === key);
      if (existing) return lines.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l));
      return [...lines, { ...line, key }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setCart((lines) => (qty <= 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? { ...l, qty } : l))));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const recordOrder = useCallback(
    ({ id, total }: { id: string; total: number }) => {
      const order: Order = { id, placedAt: new Date().toISOString(), total, lines: cart };
      setOrders((prev) => {
        const next = [order, ...prev];
        write(KEYS.orders, next);
        return next;
      });
      setCart([]);
      return order;
    },
    [cart],
  );

  const toggleSaved = useCallback((slug: string) => {
    setSaved((prev) => {
      const next = toggled(prev, slug);
      write(KEYS.saved, next);
      return next;
    });
  }, []);

  const toggleAlert = useCallback((slug: string) => {
    setAlerts((prev) => {
      const next = toggled(prev, slug);
      write(KEYS.alerts, next);
      return next;
    });
  }, []);

  const claimCoupon = useCallback(
    async (id: string) => {
      setCoupons((list) => (list.includes(id) ? list : [...list, id]));
      if (!account) return;
      const r = await claimCouponAction(id);
      if (r.ok) writeStored(KEYS.coupons, r.coupons);
    },
    [account, setCoupons],
  );

  const checkIn = useCallback(async () => {
    if (!account) return null;
    const r = await checkInAction();
    if (!r.ok) return null;
    writeStored(KEYS.coins, r.coins);
    writeStored(KEYS.checkin, r.checkin);
    return r.earned;
  }, [account]);

  const redeem = useCallback(
    async (rewardId: string): Promise<{ ok: true } | { ok: false; message: string; signIn: boolean }> => {
      if (!account) return { ok: false, message: "Sign in to spend coins.", signIn: true };
      const r = await redeemRewardAction(rewardId);
      if (!r.ok) return { ok: false, message: r.message, signIn: r.code === "signed_out" };
      writeStored(KEYS.coins, r.coins);
      writeStored(KEYS.coupons, r.coupons);
      return { ok: true };
    },
    [account],
  );

  const setMarket = useCallback((code: string) => {
    setMarketCode(code);
    write(KEYS.market, code);
  }, []);

  const market = useMemo(() => markets.find((m) => m.code === marketCode) ?? markets.find((m) => m.code === DEFAULT_MARKET) ?? markets[0], [markets, marketCode]);

  const setGlass = useCallback((value: number) => {
    setGlassState(value);
    write(KEYS.glass, value);
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      cart,
      cartCount: cart.reduce((n, l) => n + l.qty, 0),
      addToCart,
      setQty,
      clearCart,
      orders,
      recordOrder,
      saved,
      toggleSaved,
      alerts,
      toggleAlert,
      coupons,
      claimCoupon,
      coins,
      checkin,
      checkIn,
      redeem,
      account,
      refreshAccount,
      markets,
      market,
      setMarket,
      glass,
      setGlass,
    }),
    [
      ready,
      cart,
      addToCart,
      setQty,
      clearCart,
      orders,
      recordOrder,
      saved,
      toggleSaved,
      alerts,
      toggleAlert,
      coupons,
      claimCoupon,
      coins,
      checkin,
      checkIn,
      redeem,
      account,
      refreshAccount,
      markets,
      market,
      setMarket,
      glass,
      setGlass,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
