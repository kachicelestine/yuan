import type { Application, ApplicationStatus } from "./application";
import type { Membership } from "./membership";

export interface ApplicationRepository {
  find(id: string): Promise<Application | null>;
  /** The person's latest application. */
  findByAccount(accountId: string): Promise<Application | null>;
  save(application: Application): Promise<void>;
  /** Oldest first, so the queue is first come, first served. */
  listByStatus(status: ApplicationStatus, limit: number): Promise<Application[]>;
  /** True when another application already claims this shop address. */
  handleClaimed(handle: string, exceptId: string): Promise<boolean>;
}

export interface MembershipRepository {
  forAccount(accountId: string): Promise<Membership[]>;
  find(sellerId: string, accountId: string): Promise<Membership | null>;
  add(membership: Membership): Promise<void>;
}
