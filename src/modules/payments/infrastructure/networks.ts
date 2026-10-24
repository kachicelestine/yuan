import { eq } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Invoice, Transfer } from "../domain/invoice";
import type { PaymentNetwork } from "../domain/ports";
import { RAILS, type RailId } from "../domain/rails";
import { simulatedTransfers } from "./schema";

/**
 * Development network: no chain, no real money. Addresses are well-known burn
 * addresses nobody controls, and there are no wallet deep links, so a real wallet
 * can't be pointed at a test invoice by accident.
 */
export class SimulatedNetwork implements PaymentNetwork {
  readonly rails = RAILS.map((r) => r.id);
  readonly simulated = true;

  constructor(private readonly db: Database) {}

  payTo(rail: RailId) {
    if (rail === "usdc-solana") return "1nc1nerator11111111111111111111111111111111";
    if (rail === "usdt-tron") return "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    return "0x000000000000000000000000000000000000dEaD";
  }

  paymentUri() {
    return null;
  }

  async findTransfer(invoice: Invoice): Promise<Transfer | null> {
    const [t] = await this.db.select().from(simulatedTransfers).where(eq(simulatedTransfers.invoiceId, invoice.id)).limit(1);
    return t ? { txHash: t.txHash, units: t.units, at: t.at } : null;
  }

  /** What the "simulate payment" button does: pretends the buyer sent the exact amount. */
  async send(invoice: Invoice, at: Date) {
    const txHash = `sim_${invoice.id.replaceAll("-", "")}`;
    await this.db.insert(simulatedTransfers).values({ invoiceId: invoice.id, units: invoice.units, txHash, at }).onConflictDoNothing();
  }
}

/** Routes each rail to the network that serves it (e.g. Base for USDC on Base). */
export class RailRouter implements PaymentNetwork {
  readonly rails: RailId[];
  readonly simulated: boolean;

  constructor(private readonly byRail: Partial<Record<RailId, PaymentNetwork>>) {
    this.rails = Object.keys(byRail) as RailId[];
    this.simulated = Object.values(byRail).some((n) => n?.simulated);
  }

  private network(rail: RailId) {
    const n = this.byRail[rail];
    if (!n) throw new Error(`No network configured for ${rail}`);
    return n;
  }

  payTo(rail: RailId) {
    return this.network(rail).payTo(rail);
  }

  paymentUri(invoice: Invoice) {
    return this.network(invoice.rail).paymentUri(invoice);
  }

  findTransfer(invoice: Invoice) {
    return this.network(invoice.rail).findTransfer(invoice);
  }
}
