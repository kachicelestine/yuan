import type { Application, ApplicationStatus } from "./application";
import type { Invitation, Membership } from "./membership";

export interface ApplicationRepository {
  find(id: string): Promise<Application | null>;
  /** The person's latest application. */
  findByAccount(accountId: string): Promise<Application | null>;
  save(application: Application): Promise<void>;
  /** Oldest first, so the queue is first come, first served. */
  listByStatus(status: ApplicationStatus, limit: number): Promise<Application[]>;
  /** The approved application that opened a shop. */
  findBySeller(sellerId: string): Promise<Application | null>;
  /** True when another application already claims this shop address. */
  handleClaimed(handle: string, exceptId: string): Promise<boolean>;
}

export interface MembershipRepository {
  forAccount(accountId: string): Promise<Membership[]>;
  forSeller(sellerId: string): Promise<Membership[]>;
  find(sellerId: string, accountId: string): Promise<Membership | null>;
  add(membership: Membership): Promise<void>;
  remove(sellerId: string, accountId: string): Promise<boolean>;
}

export interface InvitationRepository {
  save(invitation: Invitation): Promise<void>;
  find(id: string): Promise<Invitation | null>;
  forSeller(sellerId: string): Promise<Invitation[]>;
  /** Invitations addressed to this email, newest first. */
  forEmail(email: string): Promise<Invitation[]>;
}
