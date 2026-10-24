import type { Invoice, Transfer } from "../domain/invoice";
import type { PaymentNetwork } from "../domain/ports";

/** TronGrid endpoints and the USDT (TRC-20) contract on each network. */
export const TRON_NETWORKS = {
  mainnet: { api: "https://api.trongrid.io", usdt: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
  nile: { api: "https://nile.trongrid.io", usdt: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf" },
} as const;

export type TronNetworkName = keyof typeof TRON_NETWORKS;

/** Looks this far before the invoice opened, for clock skew between us and the chain. */
const SKEW_MS = 120_000;
/** TronGrid's largest page. */
const PAGE = 200;
const MAX_PAGES = 5;

type Trc20Transfer = { transaction_id: string; token_info: { address: string }; block_timestamp: number; to: string; type: string; value: string };
type Page = { data?: Trc20Transfer[]; success?: boolean; error?: string; meta?: { fingerprint?: string } };

/**
 * Receives USDT on Tron through TronGrid's confirmed TRC-20 transfers to the treasury.
 * As on the other chains, the exact amount (with its sub-cent tag) picks the invoice.
 */
export class TronUsdtNetwork implements PaymentNetwork {
  readonly rails = ["usdt-tron"] as const;
  readonly simulated = false;
  private readonly net: (typeof TRON_NETWORKS)[TronNetworkName];

  constructor(
    private readonly opts: { treasury: string; network: TronNetworkName; apiUrl?: string; apiKey?: string; fetch?: typeof fetch },
  ) {
    this.net = TRON_NETWORKS[opts.network];
  }

  payTo() {
    return this.opts.treasury;
  }

  /** Tron has no common payment-link standard; buyers copy the address and amount. */
  paymentUri() {
    return null;
  }

  async findTransfer(invoice: Invoice): Promise<Transfer | null> {
    const want = invoice.units.toString();
    let fingerprint: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        only_confirmed: "true",
        only_to: "true",
        contract_address: this.net.usdt,
        min_timestamp: String(invoice.createdAt.getTime() - SKEW_MS),
        order_by: "block_timestamp,asc",
        limit: String(PAGE),
      });
      if (fingerprint) params.set("fingerprint", fingerprint);
      const body = await this.get(`/v1/accounts/${this.opts.treasury}/transactions/trc20?${params}`);
      for (const t of body.data ?? []) {
        if (t.type === "Transfer" && t.to === this.opts.treasury && t.token_info.address === this.net.usdt && t.value === want) {
          return { txHash: t.transaction_id, units: BigInt(t.value), at: new Date(t.block_timestamp) };
        }
      }
      fingerprint = body.meta?.fingerprint;
      if (!fingerprint || (body.data?.length ?? 0) < PAGE) return null;
    }
    return null;
  }

  private async get(path: string): Promise<Page> {
    const res = await (this.opts.fetch ?? fetch)(`${this.opts.apiUrl ?? this.net.api}${path}`, {
      headers: { accept: "application/json", ...(this.opts.apiKey ? { "TRON-PRO-API-KEY": this.opts.apiKey } : {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`TronGrid failed: HTTP ${res.status}`);
    const body = (await res.json()) as Page;
    if (body.success === false) throw new Error(`TronGrid failed: ${body.error ?? "unknown error"}`);
    return body;
  }
}
