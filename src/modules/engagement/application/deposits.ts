import { domainError, err, ok, type Cents, type Clock, type Result } from "@/shared/kernel";
import { balanceHold, balanceOf, createOffer, isOpenForDeposits, reserve, type Deposit, type DepositError, type DepositOffer, type OfferInput } from "../domain/deposit";
import type { DepositRepository } from "../domain/repositories";

export type DepositsDeps = {
  deposits: DepositRepository;
  /** Whether a live, priced listing belongs to the shop (the catalog knows). */
  listings: { owns(sellerId: string, slug: string): Promise<boolean> };
  clock: Clock;
  newId: () => string;
};

/** An offer as shoppers see it, with the viewer's own deposits on it. */
export type DepositOfferView = {
  id: string;
  sellerId: string;
  slug: string;
  kind: DepositOffer["kind"];
  title: string;
  blurb: string;
  deposit: number;
  credit: number;
  price: number;
  balance: number;
  opensAt: string;
  closesAt: string;
  balanceFrom: string;
  balanceUntil: string;
  left: number;
  perPerson: number;
  state: "upcoming" | "open" | "closed";
  /** The viewer's deposits on it, newest first. */
  mine: { id: string; status: Deposit["status"]; orderId: string | null }[];
};

/** For the shop: how its offer is doing. */
export type SellerDepositOfferView = DepositOfferView & { stock: number; paid: number; converted: number; cancelled: boolean };

/** Money that has to move when a deposit settles: from Protect to the shop, or back. */
export type DepositMoney = { depositId: string; depositOrderId: string; buyerId: string; sellerId: string; amount: Cents; title: string };

const dollars = (c: number) => c / 100;

export function makeDeposits({ deposits, listings, clock, newId }: DepositsDeps) {
  const view = (o: DepositOffer, mine: Deposit[]): DepositOfferView => {
    const now = clock.now();
    return {
      id: o.id,
      sellerId: o.sellerId,
      slug: o.slug,
      kind: o.kind,
      title: o.title,
      blurb: o.blurb,
      deposit: dollars(o.deposit),
      credit: dollars(o.credit),
      price: dollars(o.price),
      balance: dollars(balanceOf(o)),
      opensAt: o.opensAt.toISOString(),
      closesAt: o.closesAt.toISOString(),
      balanceFrom: o.balanceFrom.toISOString(),
      balanceUntil: o.balanceUntil.toISOString(),
      left: Math.max(0, o.stock - o.taken),
      perPerson: o.perPerson,
      state: isOpenForDeposits(o, now) ? "open" : now < o.opensAt ? "upcoming" : "closed",
      mine: mine.filter((d) => d.offerId === o.id && d.status !== "lapsed").map((d) => ({ id: d.id, status: d.status, orderId: d.orderId })),
    };
  };

  const money = (d: Deposit, o: DepositOffer): DepositMoney | null => (d.orderId ? { depositId: d.id, depositOrderId: d.orderId, buyerId: d.buyerId, sellerId: o.sellerId, amount: o.deposit, title: o.title } : null);

  return {
    async createOffer(sellerId: string, input: OfferInput): Promise<Result<SellerDepositOfferView, DepositError>> {
      if (!(await listings.owns(sellerId, input.slug))) return err(domainError("invalid_offer", "Pick one of your live, priced listings."));
      const o = createOffer({ id: newId(), sellerId, input, at: clock.now() });
      if (!o.ok) return o;
      await deposits.saveOffer(o.value);
      return ok({ ...view(o.value, []), stock: o.value.stock, paid: 0, converted: 0, cancelled: false });
    },

    async sellerOffers(sellerId: string): Promise<SellerDepositOfferView[]> {
      const list = await deposits.sellerOffers(sellerId);
      return Promise.all(
        list.map(async (o) => {
          const settled = await deposits.forOffer(o.id, ["paid", "converted"]);
          return { ...view(o, []), stock: o.stock, paid: settled.filter((d) => d.status === "paid").length, converted: settled.filter((d) => d.status === "converted").length, cancelled: o.cancelled };
        }),
      );
    },

    /**
     * The shop calls it off, before the balance opens. Every paid deposit is owed back;
     * the caller refunds them through Protect.
     */
    async cancelOffer(sellerId: string, offerId: string): Promise<Result<{ refunds: DepositMoney[] }, DepositError>> {
      const o = await deposits.offer(offerId);
      if (!o || o.sellerId !== sellerId) return err(domainError("not_found", "No such pre-order."));
      if (o.cancelled) return ok({ refunds: [] });
      if (clock.now() >= o.balanceFrom) return err(domainError("closed", "The balance window has opened; buyers are paying now."));
      await deposits.saveOffer({ ...o, cancelled: true });
      const refunds: DepositMoney[] = [];
      for (const d of await deposits.forOffer(o.id, ["pending", "paid"])) {
        if (d.status === "pending") await deposits.release(d);
        else {
          await deposits.save({ ...d, status: "refunded" });
          const m = money(d, o);
          if (m) refunds.push(m);
        }
      }
      return ok({ refunds });
    },

    /** Pre-orders and pre-sales shoppers can act on, with the viewer's deposits. */
    async current(viewer: string | null): Promise<DepositOfferView[]> {
      const [offers, mine] = await Promise.all([deposits.currentOffers(clock.now()), viewer ? deposits.forBuyer(viewer) : Promise.resolve([])]);
      return offers.map((o) => view(o, mine.map((m) => m.deposit)));
    },

    async mine(buyerId: string): Promise<DepositOfferView[]> {
      const list = await deposits.forBuyer(buyerId);
      const offers = [...new Map(list.map((x) => [x.offer.id, x.offer])).values()];
      return offers.map((o) => view(o, list.map((x) => x.deposit)));
    },

    /** Holds a place on the offer; the caller then opens the deposit's order and attaches it. */
    async reserve(buyerId: string, offerId: string): Promise<Result<{ deposit: Deposit; offer: DepositOffer }, DepositError>> {
      const o = await deposits.offer(offerId);
      if (!o) return err(domainError("not_found", "No such pre-order."));
      const holding = (await deposits.forBuyer(buyerId)).filter((x) => x.offer.id === o.id && x.deposit.status !== "lapsed" && x.deposit.status !== "refunded").length;
      const d = reserve({ offer: o, id: newId(), buyerId, holding, at: clock.now() });
      if (!d.ok) return d;
      if (!(await deposits.reserve(d.value))) return err(domainError("sold_out", "All the deposits are taken."));
      return ok({ deposit: d.value, offer: o });
    },

    async attachOrder(depositId: string, orderId: string) {
      const d = await deposits.find(depositId);
      if (d) await deposits.save({ ...d, orderId });
    },

    /** The deposit couldn't be opened (or its payment lapsed): its place goes back. */
    async abandon(depositId: string) {
      const d = await deposits.find(depositId);
      if (d) await deposits.release(d);
    },

    /**
     * The deposit's order was paid. `late` means its place had already gone back (the payment
     * window lapsed) or the shop cancelled: then it's owed back, and the caller refunds it.
     */
    async paid(orderId: string): Promise<{ deposit: Deposit; offer: DepositOffer; late: boolean } | null> {
      const d = await deposits.byOrder(orderId);
      if (!d) return null;
      const o = (await deposits.offer(d.offerId))!;
      if (d.status !== "pending" && d.status !== "lapsed") return { deposit: d, offer: o, late: d.status === "refunded" };
      const late = d.status === "lapsed" || o.cancelled;
      const next: Deposit = { ...d, status: late ? "refunded" : "paid", paidAt: clock.now() };
      await deposits.save(next);
      return { deposit: next, offer: o, late };
    },

    /** Its payment window lapsed: the place goes back. */
    async unpaid(orderId: string) {
      const d = await deposits.byOrder(orderId);
      if (d) await deposits.release(d);
    },

    /** The price a paid deposit holds on its listing while the balance window is open. */
    async bestHold(buyerId: string, slug: string): Promise<{ price: Cents; qty: number } | null> {
      const now = clock.now();
      const held = (await deposits.forBuyer(buyerId)).filter((x) => x.offer.slug === slug).flatMap((x) => balanceHold(x.deposit, x.offer, now) ?? []);
      return held.length ? held.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    },

    /** A paid order took the balance price: its deposits are used (one per unit bought at it). */
    async convert(buyerId: string, orderId: string, lines: readonly { slug: string; qty: number; unitPrice: Cents }[]): Promise<number> {
      const now = clock.now();
      if ((await deposits.forFinalOrder(orderId)).length) return 0;
      let n = 0;
      const mine = await deposits.forBuyer(buyerId);
      for (const line of lines) {
        let units = line.qty;
        for (const x of mine) {
          if (units === 0) break;
          const hold = balanceHold(x.deposit, x.offer, now);
          if (x.offer.slug !== line.slug || !hold || line.unitPrice > hold.price) continue;
          await deposits.save({ ...x.deposit, status: "converted", finalOrderId: orderId });
          units--;
          n++;
        }
      }
      return n;
    },

    /** Deposits that went toward this order, with the money to move for each. */
    async forFinalOrder(orderId: string): Promise<DepositMoney[]> {
      return (await deposits.forFinalOrder(orderId)).flatMap(({ deposit, offer }) => money(deposit, offer) ?? []);
    },

    /** Balance windows that closed unpaid: those deposits go to the shop (as the offer said). */
    async forfeitLapsed(): Promise<DepositMoney[]> {
      const out: DepositMoney[] = [];
      for (const { deposit, offer } of await deposits.lapsed(clock.now())) {
        await deposits.save({ ...deposit, status: "forfeited" });
        const m = money(deposit, offer);
        if (m) out.push(m);
      }
      return out;
    },

    /** Buyers whose balance window just opened (each told once). */
    async dueReminders(): Promise<{ buyerId: string; title: string; slug: string; balance: number; until: Date }[]> {
      const out = [];
      for (const { deposit, offer } of await deposits.toRemind(clock.now())) {
        await deposits.save({ ...deposit, remindedAt: clock.now() });
        out.push({ buyerId: deposit.buyerId, title: offer.title, slug: offer.slug, balance: dollars(balanceOf(offer)), until: offer.balanceUntil });
      }
      return out;
    },
  };
}

export type Deposits = ReturnType<typeof makeDeposits>;
