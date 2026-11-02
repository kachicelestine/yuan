import { eq } from "drizzle-orm";
import type { AskTurn } from "@/lib/ask";
import type { Database } from "@/shared/infrastructure/database";
import { askThreads } from "@/shared/infrastructure/platform-schema";
import type { Clock } from "@/shared/kernel";

// Ask remembers each account's current conversation, so it carries on from any device. Words
// only: cards and photos aren't kept, so nothing stale (an old price, say) can be approved
// later. "New chat" forgets it, and so does closing the account.

export const MAX_KEPT_TURNS = 20;

export function makeAskHistory(db: Database, clock: Clock) {
  return {
    async load(accountId: string): Promise<AskTurn[]> {
      const [row] = await db.select({ turns: askThreads.turns }).from(askThreads).where(eq(askThreads.accountId, accountId)).limit(1);
      return row?.turns ?? [];
    },

    /** Keeps the latest turns, words only. */
    async save(accountId: string, turns: readonly AskTurn[]) {
      const kept = turns.map(({ role, text }) => ({ role, text: text.slice(0, 2000) })).slice(-MAX_KEPT_TURNS);
      const at = clock.now();
      await db.insert(askThreads).values({ accountId, turns: kept, updatedAt: at }).onConflictDoUpdate({ target: askThreads.accountId, set: { turns: kept, updatedAt: at } });
    },

    async forget(accountId: string) {
      await db.delete(askThreads).where(eq(askThreads.accountId, accountId));
    },
  };
}

export type AskHistory = ReturnType<typeof makeAskHistory>;
