import { formatUnits, type Invoice, type Transfer } from "../domain/invoice";
import type { PaymentNetwork } from "../domain/ports";

/** USDC mints, from developers.circle.com/stablecoins/usdc-contract-addresses. */
export const SOLANA_CLUSTERS = {
  mainnet: { usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  devnet: { usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" },
} as const;

export type SolanaCluster = keyof typeof SOLANA_CLUSTERS;

/** Looks this far before the invoice opened, for clock skew between us and the chain. */
const SKEW_SECONDS = 120;
/** getSignaturesForAddress returns at most 1,000 per call. */
const PAGE = 1000;
const MAX_PAGES = 5;
/** Token accounts rarely change; finding them again every sweep would double the calls. */
const ACCOUNTS_TTL_MS = 10 * 60_000;
/** Finalized transactions never change, so what each one paid the treasury is kept. */
const RECEIPTS_KEPT = 5000;

type Signature = { signature: string; blockTime: number | null; err: unknown };
type TokenBalance = { mint: string; owner?: string; uiTokenAmount: { amount: string } };
type Tx = { blockTime: number | null; meta: { err: unknown; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } | null };
type Receipt = { units: bigint; at: Date | null };

/**
 * Receives USDC on Solana. USDC lands in the treasury's token account(s); a transfer is
 * matched to its invoice by exact amount (the sub-cent tag makes each open invoice's
 * amount unique), read from the transaction's token balances before and after. That
 * catches plain transfers, `transferChecked` and payments routed through other programs
 * alike. Only finalized transactions count.
 */
export class SolanaUsdcNetwork implements PaymentNetwork {
  readonly rails = ["usdc-solana"] as const;
  readonly simulated = false;
  private readonly mint: string;
  private accounts: { list: string[]; until: number } | null = null;
  private readonly receipts = new Map<string, Receipt>();

  constructor(
    private readonly opts: { rpcUrl: string; treasury: string; cluster: SolanaCluster; fetch?: typeof fetch; now?: () => number },
  ) {
    this.mint = SOLANA_CLUSTERS[opts.cluster].usdc;
  }

  payTo() {
    return this.opts.treasury;
  }

  /** Solana Pay transfer request: the wallet sends exactly this much USDC to the treasury. */
  paymentUri(invoice: Invoice) {
    return `solana:${this.opts.treasury}?amount=${formatUnits(invoice.units)}&spl-token=${this.mint}`;
  }

  async findTransfer(invoice: Invoice): Promise<Transfer | null> {
    const since = Math.floor(invoice.createdAt.getTime() / 1000) - SKEW_SECONDS;
    for (const account of await this.tokenAccounts()) {
      for (const sig of await this.signaturesSince(account, since)) {
        const receipt = await this.receipt(sig.signature);
        if (receipt.units === invoice.units) return { txHash: sig.signature, units: receipt.units, at: receipt.at ?? new Date((sig.blockTime ?? since) * 1000) };
      }
    }
    return null;
  }

  private async tokenAccounts(): Promise<string[]> {
    const now = this.opts.now?.() ?? Date.now();
    if (this.accounts && this.accounts.until > now) return this.accounts.list;
    const result = await this.rpc<{ value: { pubkey: string }[] }>("getTokenAccountsByOwner", [
      this.opts.treasury,
      { mint: this.mint },
      { encoding: "jsonParsed", commitment: "finalized" },
    ]);
    const list = result.value.map((a) => a.pubkey);
    this.accounts = { list, until: now + ACCOUNTS_TTL_MS };
    return list;
  }

  /** Successful transactions touching the account since `since` (unix seconds), newest first. */
  private async signaturesSince(account: string, since: number): Promise<Signature[]> {
    const out: Signature[] = [];
    let before: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await this.rpc<Signature[]>("getSignaturesForAddress", [account, { limit: PAGE, commitment: "finalized", ...(before ? { before } : {}) }]);
      for (const s of batch) {
        if (s.blockTime !== null && s.blockTime < since) return out;
        if (s.err === null) out.push(s);
      }
      if (batch.length < PAGE) return out;
      before = batch.at(-1)!.signature;
    }
    return out;
  }

  /** How much USDC the treasury gained in one transaction. */
  private async receipt(signature: string): Promise<Receipt> {
    const known = this.receipts.get(signature);
    if (known) return known;
    const tx = await this.rpc<Tx | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 }]);
    const ours = (list: TokenBalance[] | undefined) =>
      (list ?? []).filter((b) => b.mint === this.mint && b.owner === this.opts.treasury).reduce((sum, b) => sum + BigInt(b.uiTokenAmount.amount), BigInt(0));
    const receipt: Receipt =
      tx && tx.meta && tx.meta.err === null
        ? { units: ours(tx.meta.postTokenBalances) - ours(tx.meta.preTokenBalances), at: tx.blockTime === null ? null : new Date(tx.blockTime * 1000) }
        : { units: BigInt(0), at: null };
    // A transaction not visible yet is asked for again next time.
    if (tx) {
      if (this.receipts.size >= RECEIPTS_KEPT) this.receipts.delete(this.receipts.keys().next().value!);
      this.receipts.set(signature, receipt);
    }
    return receipt;
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await (this.opts.fetch ?? fetch)(this.opts.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Solana RPC ${method} failed: HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message: string } };
    if (body.error) throw new Error(`Solana RPC ${method} failed: ${body.error.message}`);
    return body.result as T;
  }
}
