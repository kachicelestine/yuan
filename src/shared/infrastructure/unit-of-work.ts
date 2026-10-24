import type { Database } from "./database";

/**
 * Runs work in one database transaction. `scope` builds the repositories the work
 * needs on top of the transaction, so everything they save commits or rolls back together.
 */
export function unitOfWork<Scope>(db: Database, scope: (tx: Database) => Scope) {
  return {
    run<T>(work: (s: Scope) => Promise<T>): Promise<T> {
      return db.transaction((tx) => work(scope(tx as unknown as Database)));
    },
  };
}
