import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { openInvoice } from "../domain/invoice";
import type { RailId } from "../domain/rails";
import { SOLANA_CLUSTERS, SolanaUsdcNetwork } from "./solana-usdc-network";
import { TRON_NETWORKS, TronUsdtNetwork } from "./tron-usdt-network";

const createdAt = new Date("2026-10-24T10:00:00Z");
const opened = (rail: RailId, payTo: string) => {
  const r = openInvoice({ id: "i1", orderId: "o1", rail, amount: cents(8740), payTo, tag: 123, at: createdAt });
  if (!r.ok) throw new Error("invoice");
  return r.value;
};
const secs = (offset: number) => Math.floor(createdAt.getTime() / 1000) + offset;

describe("SolanaUsdcNetwork", () => {
  const treasury = "TreasuryWa11et1111111111111111111111111111";
  const mint = SOLANA_CLUSTERS.mainnet.usdc;
  const invoice = opened("usdc-solana", treasury);
  const balance = (owner: string, amount: bigint, m: string = mint) => ({ mint: m, owner, uiTokenAmount: { amount: amount.toString() } });

  /** A fake JSON-RPC endpoint: answers by method, and getTransaction by signature. */
  function rpc(answers: { signatures: unknown[][]; txs: Record<string, unknown> }) {
    const calls: { method: string; params: unknown[] }[] = [];
    let page = 0;
    const fetch = (async (_url: string, init: { body: string }) => {
      const { method, params } = JSON.parse(init.body);
      calls.push({ method, params });
      const result =
        method === "getTokenAccountsByOwner"
          ? { value: [{ pubkey: "TokenAccount111111111111111111111111111111" }] }
          : method === "getSignaturesForAddress"
            ? (answers.signatures[page++] ?? [])
            : (answers.txs[params[0] as string] ?? null);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
    }) as unknown as typeof globalThis.fetch;
    return { fetch, calls };
  }
  const network = (fetch: typeof globalThis.fetch) => new SolanaUsdcNetwork({ rpcUrl: "https://rpc.test", treasury, cluster: "mainnet", fetch, now: () => createdAt.getTime() });

  it("builds a Solana Pay link for the exact amount", () => {
    expect(network(rpc({ signatures: [], txs: {} }).fetch).paymentUri(invoice)).toBe(`solana:${treasury}?amount=87.400123&spl-token=${mint}`);
  });

  it("finds the transaction that paid the treasury exactly the invoice amount", async () => {
    const { fetch, calls } = rpc({
      signatures: [
        [
          { signature: "newer", blockTime: secs(90), err: null },
          { signature: "paid", blockTime: secs(60), err: null },
          { signature: "failed", blockTime: secs(50), err: { InstructionError: [0, "x"] } },
        ],
      ],
      txs: {
        // Someone else's USDC moved; the treasury gained nothing.
        newer: { blockTime: secs(90), meta: { err: null, preTokenBalances: [balance("someone", BigInt(100))], postTokenBalances: [balance("someone", BigInt(87400123))] } },
        paid: { blockTime: secs(60), meta: { err: null, preTokenBalances: [balance(treasury, BigInt(5_000_000))], postTokenBalances: [balance(treasury, BigInt(5_000_000) + invoice.units)] } },
      },
    });
    const n = network(fetch);
    expect(await n.findTransfer(invoice)).toEqual({ txHash: "paid", units: invoice.units, at: new Date(secs(60) * 1000) });
    expect(calls.filter((c) => c.method === "getTransaction").map((c) => c.params[0])).toEqual(["newer", "paid"]);

    // A second sweep reads each transaction once only.
    await n.findTransfer(invoice);
    expect(calls.filter((c) => c.method === "getTransaction")).toHaveLength(2);
    expect(calls.filter((c) => c.method === "getTokenAccountsByOwner")).toHaveLength(1);
  });

  it("ignores other tokens and stops at transactions older than the invoice", async () => {
    const { fetch, calls } = rpc({
      signatures: [
        [
          { signature: "fake-usdc", blockTime: secs(30), err: null },
          { signature: "old", blockTime: secs(-3600), err: null },
        ],
      ],
      txs: { "fake-usdc": { blockTime: secs(30), meta: { err: null, preTokenBalances: [], postTokenBalances: [balance(treasury, invoice.units, "FakeMint1111111111111111111111111111111111")] } } },
    });
    expect(await network(fetch).findTransfer(invoice)).toBeNull();
    expect(calls.filter((c) => c.method === "getTransaction").map((c) => c.params[0])).toEqual(["fake-usdc"]);
  });

  it("surfaces RPC errors", async () => {
    const fetch = (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "rate limited" } }))) as unknown as typeof globalThis.fetch;
    await expect(network(fetch).findTransfer(invoice)).rejects.toThrow(/rate limited/);
  });
});

describe("TronUsdtNetwork", () => {
  const treasury = "TTreasury1111111111111111111111111";
  const usdt = TRON_NETWORKS.mainnet.usdt;
  const invoice = opened("usdt-tron", treasury);
  const transfer = (id: string, value: bigint, over: Partial<{ to: string; token: string; at: number }> = {}) => ({
    transaction_id: id,
    token_info: { address: over.token ?? usdt, decimals: 6, symbol: "USDT" },
    block_timestamp: over.at ?? createdAt.getTime() + 60_000,
    from: "TBuyer",
    to: over.to ?? treasury,
    type: "Transfer",
    value: value.toString(),
  });

  function api(pages: unknown[]) {
    const urls: URL[] = [];
    const headers: Record<string, string>[] = [];
    const fetch = (async (url: string, init: { headers: Record<string, string> }) => {
      urls.push(new URL(url));
      headers.push(init.headers);
      return new Response(JSON.stringify(pages[urls.length - 1] ?? { data: [], success: true, meta: {} }));
    }) as unknown as typeof globalThis.fetch;
    return { fetch, urls, headers };
  }
  const network = (fetch: typeof globalThis.fetch, apiKey?: string) => new TronUsdtNetwork({ treasury, network: "mainnet", apiKey, fetch });

  it("finds a confirmed USDT transfer of exactly the invoice amount", async () => {
    const { fetch, urls, headers } = api([
      {
        success: true,
        data: [transfer("short", invoice.units - BigInt(1)), transfer("other-token", invoice.units, { token: "TOther" }), transfer("paid", invoice.units)],
        meta: {},
      },
    ]);
    expect(await network(fetch, "key-123").findTransfer(invoice)).toEqual({ txHash: "paid", units: invoice.units, at: new Date(createdAt.getTime() + 60_000) });
    const [url] = urls;
    expect(url.origin + url.pathname).toBe(`${TRON_NETWORKS.mainnet.api}/v1/accounts/${treasury}/transactions/trc20`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ only_confirmed: "true", only_to: "true", contract_address: usdt, min_timestamp: String(createdAt.getTime() - 120_000) });
    expect(headers[0]["TRON-PRO-API-KEY"]).toBe("key-123");
  });

  it("follows the page cursor and returns null when nothing matches", async () => {
    const full = Array.from({ length: 200 }, (_, i) => transfer(`t${i}`, BigInt(1000 + i)));
    const { fetch, urls } = api([{ success: true, data: full, meta: { fingerprint: "next-page" } }, { success: true, data: [], meta: {} }]);
    expect(await network(fetch).findTransfer(invoice)).toBeNull();
    expect(urls).toHaveLength(2);
    expect(urls[1].searchParams.get("fingerprint")).toBe("next-page");
  });

  it("has no wallet link, and surfaces API errors", async () => {
    const { fetch } = api([{ success: false, error: "bad address" }]);
    expect(network(fetch).paymentUri()).toBeNull();
    await expect(network(fetch).findTransfer(invoice)).rejects.toThrow(/bad address/);
  });
});
