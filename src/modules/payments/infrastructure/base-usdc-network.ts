import type { Invoice, Transfer } from "../domain/invoice";
import type { PaymentNetwork } from "../domain/ports";

/** USDC contracts, from developers.circle.com/stablecoins/usdc-contract-addresses. */
export const BASE_CHAINS = {
  base: { chainId: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  "base-sepolia": { chainId: 84532, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
} as const;

export type BaseChain = keyof typeof BASE_CHAINS;

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/** Base produces a block every 2 seconds. */
const BLOCK_SECONDS = 2;
/** Most public RPCs cap eth_getLogs ranges; an invoice's window is ~900 blocks. */
const MAX_RANGE = 5_000;

type Log = { data: string; transactionHash: string; blockNumber: string };

/**
 * Receives USDC on Base. Every invoice pays the same treasury address, so a transfer is
 * matched to its invoice by exact amount: the sub-cent tag makes each open invoice's
 * amount unique (enforced by a database index).
 */
export class BaseUsdcNetwork implements PaymentNetwork {
  readonly rails = ["usdc-base"] as const;
  readonly simulated = false;
  private readonly chain: (typeof BASE_CHAINS)[BaseChain];

  constructor(
    private readonly opts: { rpcUrl: string; treasury: string; chain: BaseChain; fetch?: typeof fetch; now?: () => number },
  ) {
    this.chain = BASE_CHAINS[opts.chain];
  }

  payTo() {
    return this.opts.treasury;
  }

  /** EIP-681: opens the wallet with the token transfer filled in. */
  paymentUri(invoice: Invoice) {
    return `ethereum:${this.chain.usdc}@${this.chain.chainId}/transfer?address=${this.opts.treasury}&uint256=${invoice.units}`;
  }

  async findTransfer(invoice: Invoice): Promise<Transfer | null> {
    const latest = BigInt(await this.rpc<string>("eth_blockNumber", []));
    const now = this.opts.now?.() ?? Date.now();
    const ageBlocks = BigInt(Math.ceil((now - invoice.createdAt.getTime()) / 1000 / BLOCK_SECONDS) + 30);
    const span = ageBlocks > BigInt(MAX_RANGE) ? BigInt(MAX_RANGE) : ageBlocks;
    const from = latest > span ? latest - span : BigInt(0);

    const logs = await this.rpc<Log[]>("eth_getLogs", [
      {
        address: this.chain.usdc,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: "latest",
        topics: [TRANSFER_TOPIC, null, `0x${this.opts.treasury.slice(2).toLowerCase().padStart(64, "0")}`],
      },
    ]);
    const match = logs.find((l) => BigInt(l.data) === invoice.units);
    if (!match) return null;

    const block = await this.rpc<{ timestamp: string }>("eth_getBlockByNumber", [match.blockNumber, false]);
    return { txHash: match.transactionHash, units: BigInt(match.data), at: new Date(Number(BigInt(block.timestamp)) * 1000) };
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await (this.opts.fetch ?? fetch)(this.opts.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Base RPC ${method} failed: HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message: string } };
    if (body.error) throw new Error(`Base RPC ${method} failed: ${body.error.message}`);
    return body.result as T;
  }
}
