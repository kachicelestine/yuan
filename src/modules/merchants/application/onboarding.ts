import { domainError, err, ok, type Clock, type DomainError, type EventLog, type ObjectStorage, type Result } from "@/shared/kernel";
import {
  approve,
  attachDocument,
  DOCUMENT_KINDS,
  newApplication,
  reject,
  saveDetails,
  submit,
  type Application,
  type ApplicationError,
  type ApplicationStatus,
  type BusinessDetails,
  type DocumentKind,
} from "../domain/application";
import type { Membership } from "../domain/membership";
import type { ApplicationRepository, MembershipRepository } from "../domain/repositories";

/** Opens the shop in the catalog when an application is approved. */
export interface ShopOpener {
  /** True when a shop already uses this address. */
  exists(handle: string): Promise<boolean>;
  open(shop: { handle: string; name: string; kind: BusinessDetails["kind"]; city: string; country: string; bio: string; yearsInBusiness: number | null }): Promise<void>;
}

export type OnboardingScope = { applications: ApplicationRepository; memberships: MembershipRepository; shops: ShopOpener; events: EventLog };

export type OnboardingDeps = {
  applications: ApplicationRepository;
  memberships: MembershipRepository;
  shops: ShopOpener;
  /** Private: documents are never public; reviewers get links that expire. */
  documents: Pick<ObjectStorage, "signUpload" | "head" | "signDownload">;
  uow: { run<T>(work: (scope: OnboardingScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
};

export type OnboardingError = ApplicationError | DomainError<"handle_taken" | "not_found" | "unsupported_type" | "too_large">;

/** The applicant's view of their application. Document keys stay on the server. */
export type ApplicationView = {
  id: string;
  status: ApplicationStatus;
  business: BusinessDetails | null;
  payoutWallet: string | null;
  documents: { kind: DocumentKind; contentType: string; bytes: number; uploadedAt: string }[];
  submittedAt: string | null;
  decisionNote: string | null;
  sellerId: string | null;
};

/** What a reviewer sees: everything, with documents as short-lived links. */
export type ReviewView = Omit<ApplicationView, "documents"> & { accountId: string; createdAt: string; documents: (ApplicationView["documents"][number] & { url: string })[] };

const DOCUMENT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
/** Long enough to review a few documents; short enough that a leaked link soon dies. */
const LINK_SECONDS = 10 * 60;

const toView = (a: Application): ApplicationView => ({
  id: a.id,
  status: a.status,
  business: a.business,
  payoutWallet: a.payoutWallet,
  documents: a.documents.map((d) => ({ kind: d.kind, contentType: d.contentType, bytes: d.bytes, uploadedAt: d.uploadedAt.toISOString() })),
  submittedAt: a.submittedAt?.toISOString() ?? null,
  decisionNote: a.decisionNote,
  sellerId: a.sellerId,
});

/** Applying to sell, and reviewing applications. */
export function makeOnboarding({ applications, memberships, shops, documents, uow, clock, newId }: OnboardingDeps) {
  /** The person's application, started on first use. */
  async function current(accountId: string) {
    return (await applications.findByAccount(accountId)) ?? newApplication({ id: newId(), accountId, at: clock.now() });
  }

  const prefix = (accountId: string) => `kyc/${accountId}/`;

  return {
    async mine(accountId: string): Promise<ApplicationView | null> {
      const a = await applications.findByAccount(accountId);
      return a && toView(a);
    },

    /** The shops this person can run. */
    memberships: (accountId: string): Promise<Membership[]> => memberships.forAccount(accountId),

    async saveDetails(accountId: string, business: BusinessDetails, payoutWallet: string | null): Promise<Result<ApplicationView, OnboardingError>> {
      const a = await current(accountId);
      const next = saveDetails(a, business, payoutWallet);
      if (!next.ok) return next;
      const handle = next.value.business!.handle;
      if ((await applications.handleClaimed(handle, a.id)) || (await shops.exists(handle))) {
        return err(domainError("handle_taken", `The shop address /s/${handle} is taken. Try another.`));
      }
      await applications.save(next.value);
      return ok(toView(next.value));
    },

    /** A ticket to upload one identity or business document to private storage. */
    async startDocument(accountId: string, file: { kind: DocumentKind; contentType: string; bytes: number }): Promise<Result<{ key: string; url: string; method: "PUT"; headers: Readonly<Record<string, string>> }, OnboardingError>> {
      if (!DOCUMENT_KINDS.includes(file.kind)) return err(domainError("invalid_details", "Unknown document type."));
      const ext = DOCUMENT_TYPES[file.contentType];
      if (!ext) return err(domainError("unsupported_type", "Upload a photo (JPEG, PNG, WebP) or a PDF."));
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_DOCUMENT_BYTES) return err(domainError("too_large", "Documents can be up to 15 MB."));
      const key = `${prefix(accountId)}${newId()}.${ext}`;
      return ok({ key, ...(await documents.signUpload(key, file, 15 * 60)) });
    },

    async attachDocument(accountId: string, input: { kind: DocumentKind; key: string }): Promise<Result<ApplicationView, OnboardingError>> {
      if (!input.key.startsWith(prefix(accountId))) return err(domainError("not_found", "That upload isn't yours."));
      const stored = await documents.head(input.key);
      if (!stored) return err(domainError("not_found", "The upload didn't finish. Try again."));
      const a = await current(accountId);
      const next = attachDocument(a, { kind: input.kind, key: input.key, contentType: stored.contentType, bytes: stored.size, uploadedAt: clock.now() });
      if (!next.ok) return next;
      await applications.save(next.value);
      return ok(toView(next.value));
    },

    async submit(accountId: string): Promise<Result<ApplicationView, OnboardingError>> {
      const a = await applications.findByAccount(accountId);
      if (!a) return err(domainError("not_found", "Start an application first."));
      const done = submit(a, clock.now());
      if (!done.ok) return done;
      await uow.run(async (s) => {
        await s.applications.save(done.value.application);
        await s.events.record(a.id, done.value.event);
      });
      return ok(toView(done.value.application));
    },

    /** Reviewers: the queue, oldest first. */
    async queue(status: ApplicationStatus = "submitted", limit = 50): Promise<ApplicationView[]> {
      return (await applications.listByStatus(status, limit)).map(toView);
    },

    async review(id: string): Promise<ReviewView | null> {
      const a = await applications.find(id);
      if (!a) return null;
      const view = toView(a);
      const links = await Promise.all(a.documents.map((d) => documents.signDownload(d.key, LINK_SECONDS)));
      return { ...view, accountId: a.accountId, createdAt: a.createdAt.toISOString(), documents: view.documents.map((d, i) => ({ ...d, url: links[i] })) };
    },

    /** Opens the shop, makes the applicant its owner, and records the decision, in one transaction. */
    async approve(reviewerId: string, id: string): Promise<Result<ApplicationView, OnboardingError>> {
      const a = await applications.find(id);
      if (!a || !a.business) return err(domainError("not_found", "No such application."));
      const b = a.business;
      const done = approve(a, reviewerId, b.handle, clock.now());
      if (!done.ok) return done;
      const taken = await shops.exists(b.handle);
      if (taken) return err(domainError("handle_taken", `A shop already uses /s/${b.handle}. Ask the applicant to pick another.`));
      await uow.run(async (s) => {
        await s.shops.open({ handle: b.handle, name: b.name, kind: b.kind, city: b.city, country: b.country, bio: b.description, yearsInBusiness: b.yearsInBusiness });
        await s.memberships.add({ sellerId: b.handle, accountId: a.accountId, role: "owner", since: clock.now() });
        await s.applications.save(done.value.application);
        await s.events.record(a.id, done.value.event);
      });
      return ok(toView(done.value.application));
    },

    async reject(reviewerId: string, id: string, note: string): Promise<Result<ApplicationView, OnboardingError>> {
      const a = await applications.find(id);
      if (!a) return err(domainError("not_found", "No such application."));
      const done = reject(a, reviewerId, note, clock.now());
      if (!done.ok) return done;
      await uow.run(async (s) => {
        await s.applications.save(done.value.application);
        await s.events.record(a.id, done.value.event);
      });
      return ok(toView(done.value.application));
    },
  };
}

export type Onboarding = ReturnType<typeof makeOnboarding>;
