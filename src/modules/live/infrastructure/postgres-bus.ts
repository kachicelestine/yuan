import { sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { LiveBus, LiveSignal } from "../domain/repositories";

/** The one Postgres channel live updates travel on. */
const CHANNEL = "live";
/** NOTIFY payloads must stay under 8,000 bytes. */
const MAX_PAYLOAD = 7_500;

type Listener = (signal: LiveSignal) => void;
type ListeningClient = { listen(channel: string, onNotify: (payload: string) => void): Promise<unknown> };

/**
 * Live updates through Postgres LISTEN/NOTIFY: every server instance listens on one channel
 * and hands each update to the viewers connected to it. No extra service to run; when one
 * database can't keep up with the fan-out, a pub/sub service replaces this adapter.
 */
export class PostgresBus implements LiveBus {
  private readonly listeners = new Map<string, Set<Listener>>();
  private listening: Promise<unknown> | null = null;

  /** `listener` is a connection that stays with one server: LISTEN doesn't survive a pooler. */
  constructor(
    private readonly db: Database,
    private readonly listener: () => Promise<ListeningClient> = async () => (db as unknown as { $client: ListeningClient }).$client,
  ) {}

  private ensureListening() {
    this.listening ??= this.listener()
      .then((client) =>
        client.listen(CHANNEL, (payload) => {
          try {
            const { s, d } = JSON.parse(payload) as { s: string; d: LiveSignal };
            for (const l of this.listeners.get(s) ?? []) l(d);
          } catch {
            // A malformed notification is dropped; viewers resync on reconnect.
          }
        }),
      )
      .catch((error) => {
        this.listening = null;
        throw error;
      });
    return this.listening;
  }

  async publish(showId: string, signal: LiveSignal) {
    const payload = JSON.stringify({ s: showId, d: signal });
    if (payload.length > MAX_PAYLOAD) return;
    await this.db.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
  }

  subscribe(showId: string, listener: Listener) {
    void this.ensureListening();
    let set = this.listeners.get(showId);
    if (!set) this.listeners.set(showId, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(showId);
    };
  }

  /** Viewers connected to this instance, per show (for the viewer count). */
  watching(showId: string) {
    return this.listeners.get(showId)?.size ?? 0;
  }
}
