import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { openInvoice } from "../domain/invoice";
import { BASE_CHAINS, BaseUsdcNetwork } from "./base-usdc-network";

const treasury = "0x1111111111111111111111111111111111111111";
const createdAt = new Date("2026-10-24T10:00:00Z");
const invoice = (() => {
  const r = openInvoice({ id: "i1", orderId: "o1", rail: "usdc-base", amount: cents(8740), payTo: treasury, tag: 123, at: createdAt });
  if (!r.ok) throw new Error("invoice");
  return r.value;
})();

/** A fake JSON-RPC endpoint that records calls and answers from a table. */
function rpc(answers: Record<string, unknown>) {
  const calls: { method: string; params: unknown[] }[] = [];
  const fetch = (async (_url: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body);
    calls.push({ method, params });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: answers[method] }));
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const network = (fetch: typeof globalThis.fetch) =>
  new BaseUsdcNetwork({ rpcUrl: "https://rpc.test", treasury, chain: "base", fetch, now: () => createdAt.getTime() + 10 * 60_000 });

describe("BaseUsdcNetwork", () => {
  it("builds an EIP-681 link for the exact amount", () => {
    expect(network(rpc({}).fetch).paymentUri(invoice)).toBe(`ethereum:${BASE_CHAINS.base.usdc}@8453/transfer?address=${treasury}&uint256=87400123`);
  });

  it("finds the transfer of exactly the invoice amount to the treasury", async () => {
    const { fetch, calls } = rpc({
      eth_blockNumber: "0x1000",
      eth_getLogs: [
        { data: "0x" + (BigInt(87400124)).toString(16).padStart(64, "0"), transactionHash: "0xother", blockNumber: "0xff0" },
        { data: "0x" + invoice.units.toString(16).padStart(64, "0"), transactionHash: "0xpaid", blockNumber: "0xff1" },
      ],
      eth_getBlockByNumber: { timestamp: "0x" + Math.floor(createdAt.getTime() / 1000 + 120).toString(16) },
    });
    const t = await network(fetch).findTransfer(invoice);
    expect(t).toEqual({ txHash: "0xpaid", units: invoice.units, at: new Date(createdAt.getTime() + 120_000) });

    const logs = calls.find((c) => c.method === "eth_getLogs")!.params[0] as { address: string; fromBlock: string; topics: (string | null)[] };
    expect(logs.address).toBe(BASE_CHAINS.base.usdc);
    expect(logs.topics[2]).toBe("0x" + treasury.slice(2).padStart(64, "0"));
    // 10 minutes of 2-second blocks, plus a margin: 0x1000 - 330 = 0xeb6
    expect(logs.fromBlock).toBe("0xeb6");
  });

  it("returns null when nothing matching has landed", async () => {
    const { fetch } = rpc({ eth_blockNumber: "0x10", eth_getLogs: [] });
    expect(await network(fetch).findTransfer(invoice)).toBeNull();
  });

  it("surfaces RPC errors", async () => {
    const fetch = (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "rate limited" } }))) as unknown as typeof globalThis.fetch;
    await expect(network(fetch).findTransfer(invoice)).rejects.toThrow(/rate limited/);
  });
});
