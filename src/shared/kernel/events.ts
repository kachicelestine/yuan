/** Something that happened in the domain, named in the past tense ("OrderPaid"). */
export type DomainEvent = Readonly<{ type: string; at: Date }>;

/**
 * Records events in the same transaction as the change that caused them (an outbox), so an
 * event is never lost when the change commits and never sent when it rolls back. A background
 * dispatcher delivers them afterwards; handlers must be idempotent because delivery is
 * at-least-once.
 */
export interface EventLog {
  /** `aggregateId` is what the event happened to; events for one aggregate are keyed by it. */
  record(aggregateId: string, event: DomainEvent): Promise<void>;
}
