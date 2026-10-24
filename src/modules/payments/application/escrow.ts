import { domainError, err, money, ok, type Cents, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import { cancelPayout, markSent, requestCreatorPayout, requestPayout, requestRefund, type Disbursement, type DisbursementError, type DisbursementSent } from "../domain/disbursement";
import { accounts, disbursed, orderSettled, payoutCancelled, payoutRequested, refundOwed, sellerRelease } from "../domain/ledger";
import type { DisbursementRepository, InvoiceRepository, Ledger } from "../domain/ports";
import type { RailId } from "../domain/rails";

/** What payments needs to know about an order to close its escrow (ordering owns the order). */
export interface OrderTotals {
  /** The buyer, the lines' total before the coupon, and the coupon. */
  find(orderId: string): Promise<{ buyerId: string; subtotal: Cents; discount: Cents } | null>;
}

/** Where a shop or creator wants its money (merchants and affiliates own the wallets). */
export interface PayoutWallets {
  forSeller(sellerId: string): Promise<string | null>;
  forCreator(accountId: string): Promise<string | null>;
}

/** What a released parcel owes the creator who referred the order (affiliates decides). */
export interface Referrals {
  forRelease(orderId: string, sellerId: string): Promise<{ creatorId: string; amount: Cents } | null>;
}

export type EscrowScope = { ledger: Ledger; disbursements: DisbursementRepository; events: EventLog };

export type EscrowDeps = {
  ledger: Ledger;
  disbursements: DisbursementRepository;
  invoices: InvoiceRepository;
  orders: OrderTotals;
  wallets: PayoutWallets;
  referrals?: Referrals;
  uow: { run<T>(work: (scope: EscrowScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  /** Share of each sale the platform keeps, e.g. 0.06. */
  commissionRate: number;
  /** The rail payouts and refunds are sent on. */
  payoutRail: RailId;
};

export type EscrowError = DisbursementError | DomainError<"not_found">;

export type DisbursementView = {
  id: string;
  kind: Disbursement["kind"];
  sellerId: string | null;
  /** Creator payouts: the creator. */
  accountId: string | null;
  orderId: string | null;
  amount: number;
  address: string | null;
  status: Disbursement["status"];
  txHash: string | null;
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
  /** Refunds: the buyer's payment, to find where to send it back. */
  paymentTx?: string | null;
};

const toView = (d: Disbursement): DisbursementView => ({
  id: d.id,
  kind: d.kind,
  sellerId: d.sellerId,
  accountId: d.kind === "creator" ? d.accountId : null,
  orderId: d.orderId,
  amount: d.amount / 100,
  address: d.address,
  status: d.status,
  txHash: d.txHash,
  note: d.note,
  requestedAt: d.requestedAt.toISOString(),
  decidedAt: d.decidedAt?.toISOString() ?? null,
});

/**
 * Protect: money moves out of escrow when a parcel is delivered (to the shop, less
 * commission) or refunded (back to the buyer), and the rest when the order is done.
 * Every step is a ledger journal with a reference unique to its cause, so an event
 * delivered twice posts once.
 */
export function makeEscrow({ ledger, disbursements, invoices, orders, wallets, referrals, uow, clock, newId, commissionRate, payoutRail }: EscrowDeps) {
  // What the ledger owes an account. 0 - x rather than -x, so an empty balance is 0, not -0.
  const owed = async (account: string) => money.cents(0 - (await ledger.balance(account)));
  /** A shop's withdrawable balance. */
  const available = (sellerId: string) => owed(accounts.seller(sellerId));
  /** A creator's withdrawable earnings. */
  const creatorAvailable = (accountId: string) => owed(accounts.creator(accountId));

  async function savePayout(d: Disbursement, account: string) {
    const j = payoutRequested({ id: newId(), payoutId: d.id, account, amount: d.amount, at: clock.now() });
    if (!j.ok) throw new Error(j.error.message);
    await uow.run(async (s) => {
      await s.disbursements.save(d);
      await s.ledger.post(j.value);
    });
  }

  return {
    available,
    creatorAvailable,

    /** ShipmentDelivered: the shop's share leaves escrow (and the creator's, if one referred the order). */
    async release(e: { orderId: string; sellerId: string; amount: Cents }): Promise<boolean> {
      const affiliate = referrals ? await referrals.forRelease(e.orderId, e.sellerId) : null;
      const j = sellerRelease({ id: newId(), ...e, commissionRate, affiliate, at: clock.now() });
      if (!j.ok) throw new Error(j.error.message);
      return ledger.postOnce(j.value);
    },

    /** ShipmentRefunded: the parcel's share is owed back to the buyer; a moderator sends it. */
    async refund(e: { orderId: string; sellerId: string; amount: Cents }): Promise<boolean> {
      const order = await orders.find(e.orderId);
      if (!order) throw new Error(`Order ${e.orderId} not found`);
      const j = refundOwed({ id: newId(), ...e, at: clock.now() });
      if (!j.ok) throw new Error(j.error.message);
      return uow.run(async (s) => {
        if (!(await s.ledger.postOnce(j.value))) return false;
        if (!(await s.disbursements.findRefund(e.orderId, e.sellerId))) {
          await s.disbursements.save(requestRefund({ id: newId(), orderId: e.orderId, sellerId: e.sellerId, accountId: order.buyerId, amount: e.amount, address: null, at: clock.now() }));
        }
        return true;
      });
    },

    /** OrderCompleted: close the order's escrow. */
    async settle(e: { orderId: string }): Promise<boolean> {
      const [order, invoice] = await Promise.all([orders.find(e.orderId), invoices.findByOrder(e.orderId)]);
      if (!order || !invoice) throw new Error(`Order ${e.orderId} has no paid invoice`);
      const remainder = money.cents(invoice.amount - order.subtotal);
      if (remainder === 0 && order.discount === 0) return false;
      const j = orderSettled({ id: newId(), orderId: e.orderId, remainder, discount: order.discount, at: clock.now() });
      if (!j.ok) throw new Error(j.error.message);
      return ledger.postOnce(j.value);
    },

    async requestPayout(sellerId: string, amount: Cents): Promise<Result<DisbursementView, EscrowError>> {
      const [balance, wallet] = await Promise.all([available(sellerId), wallets.forSeller(sellerId)]);
      const d = requestPayout({ id: newId(), sellerId, amount, available: balance, address: wallet ?? "", at: clock.now() });
      if (!d.ok) return d;
      await savePayout(d.value, accounts.seller(sellerId));
      return ok(toView(d.value));
    },

    async requestCreatorPayout(accountId: string, amount: Cents): Promise<Result<DisbursementView, EscrowError>> {
      const [balance, wallet] = await Promise.all([creatorAvailable(accountId), wallets.forCreator(accountId)]);
      const d = requestCreatorPayout({ id: newId(), accountId, amount, available: balance, address: wallet ?? "", at: clock.now() });
      if (!d.ok) return d;
      await savePayout(d.value, accounts.creator(accountId));
      return ok(toView(d.value));
    },

    async payouts(sellerId: string, limit = 20): Promise<DisbursementView[]> {
      return (await disbursements.payoutsFor(sellerId, limit)).map(toView);
    },

    async creatorPayouts(accountId: string, limit = 20): Promise<DisbursementView[]> {
      return (await disbursements.creatorPayoutsFor(accountId, limit)).map(toView);
    },

    /** The queue of money to send, with the buyer's payment for refunds. */
    async pending(limit = 50): Promise<DisbursementView[]> {
      const list = await disbursements.pending(limit);
      return Promise.all(
        list.map(async (d) => ({ ...toView(d), ...(d.kind === "refund" && d.orderId ? { paymentTx: (await invoices.findByOrder(d.orderId))?.txHash ?? null } : {}) })),
      );
    },

    /** A person sent it from the treasury wallet; record the transaction. */
    async markSent(by: string, id: string, input: { txHash: string; address: string | null }): Promise<Result<DisbursementView, EscrowError>> {
      const d = await disbursements.find(id);
      if (!d) return err(domainError("not_found", "No such transfer."));
      const sent = markSent(d, input, by, clock.now());
      if (!sent.ok) return sent;
      if (await disbursements.txRecorded(sent.value.txHash!)) return err(domainError("invalid_tx", "That transaction is already recorded for another transfer."));
      const j = disbursed({ id: newId(), disbursementId: d.id, kind: d.kind, rail: payoutRail, amount: d.amount, at: clock.now() });
      if (!j.ok) throw new Error(j.error.message);
      const event: DisbursementSent = { type: "DisbursementSent", disbursementId: d.id, kind: d.kind, sellerId: d.sellerId, accountId: d.accountId, amount: d.amount, txHash: sent.value.txHash!, at: clock.now() };
      await uow.run(async (s) => {
        await s.disbursements.save(sent.value);
        await s.ledger.post(j.value);
        await s.events.record(d.id, event);
      });
      return ok(toView(sent.value));
    },

    async cancelPayout(by: string, id: string, note: string): Promise<Result<DisbursementView, EscrowError>> {
      const d = await disbursements.find(id);
      if (!d) return err(domainError("not_found", "No such payout."));
      const done = cancelPayout(d, note, by, clock.now());
      if (!done.ok) return done;
      const account = d.kind === "creator" ? accounts.creator(d.accountId!) : accounts.seller(d.sellerId!);
      const j = payoutCancelled({ id: newId(), payoutId: d.id, account, amount: d.amount, at: clock.now() });
      if (!j.ok) throw new Error(j.error.message);
      await uow.run(async (s) => {
        await s.disbursements.save(done.value);
        await s.ledger.post(j.value);
      });
      return ok(toView(done.value));
    },
  };
}

export type Escrow = ReturnType<typeof makeEscrow>;
