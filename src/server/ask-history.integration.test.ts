import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { closeAccount, exportAccount } from "./account-closure";
import { MAX_KEPT_TURNS } from "./ask-history";
import { wire } from "./container";

// Ask carries a conversation across devices: words only, the latest turns, gone on "New chat"
// or when the account closes.
describe("Ask history", () => {
  let db: Database;
  const app = () => wire(db, { payments: { network: new SimulatedNetwork(db), simulator: null } });
  const someone = newId();

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
  });

  it("keeps the latest turns, without photos", async () => {
    expect(await app().askHistory.load(someone)).toEqual([]);
    await app().askHistory.save(someone, [
      { role: "user", text: "Find this", photo: "aGVsbG8=" },
      { role: "assistant", text: "That looks like a power bank." },
    ]);
    expect(await app().askHistory.load(someone)).toEqual([
      { role: "user", text: "Find this" },
      { role: "assistant", text: "That looks like a power bank." },
    ]);
    const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), text: `turn ${i}` }));
    await app().askHistory.save(someone, long);
    const kept = await app().askHistory.load(someone);
    expect(kept).toHaveLength(MAX_KEPT_TURNS);
    expect(kept.at(-1)?.text).toBe("turn 29");
  });

  it("goes into the account's export, and is forgotten when the account closes", async () => {
    expect((await exportAccount(app(), someone, { email: null, wallet: null })).ask).toHaveLength(MAX_KEPT_TURNS);
    await closeAccount(app(), someone);
    expect(await app().askHistory.load(someone)).toEqual([]);
  });
});
