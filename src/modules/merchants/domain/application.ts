import { SELLER_KINDS, type SellerKind } from "@/modules/catalog";
import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// Becoming a seller: a person applies with their business details, identity and business
// documents and a payout wallet; a reviewer approves (a shop opens) or rejects with a
// reason. Reviews are manual for now. An automatic verifier (Smile ID, Persona) can take
// the first pass later by subscribing to ApplicationSubmitted.

export const DOCUMENT_KINDS = ["business_license", "id_front", "id_back", "selfie", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** What a reviewer needs before approving: proof of the business and of the person. */
export const REQUIRED_DOCUMENTS: readonly DocumentKind[] = ["business_license", "id_front"];

export type ApplicationStatus = "draft" | "submitted" | "approved" | "rejected";

export type BusinessDetails = Readonly<{
  /** The shop's public name. */
  name: string;
  /** The shop's address on the site: /s/<handle>. */
  handle: string;
  kind: SellerKind;
  /** ISO country code where the business is registered. */
  country: string;
  city: string;
  address: string;
  phone: string;
  website: string | null;
  yearsInBusiness: number | null;
  /** What they make or sell, in their words; becomes the shop's bio. */
  description: string;
}>;

export type KycDocument = Readonly<{
  kind: DocumentKind;
  /** Private storage key; only reviewers get short-lived links to it. */
  key: string;
  contentType: string;
  bytes: number;
  uploadedAt: Date;
}>;

export type Application = Readonly<{
  id: string;
  accountId: string;
  status: ApplicationStatus;
  business: BusinessDetails | null;
  /** USDC on Base address that payouts go to. */
  payoutWallet: string | null;
  documents: readonly KycDocument[];
  createdAt: Date;
  submittedAt: Date | null;
  decidedAt: Date | null;
  /** The reviewer's account. */
  decidedBy: string | null;
  /** Shown to the applicant when rejected. */
  decisionNote: string | null;
  /** The shop opened on approval. */
  sellerId: string | null;
}>;

export type ApplicationSubmitted = Readonly<{ type: "ApplicationSubmitted"; applicationId: string; accountId: string; at: Date }>;
export type ApplicationApproved = Readonly<{ type: "ApplicationApproved"; applicationId: string; accountId: string; sellerId: string; at: Date }>;
export type ApplicationRejected = Readonly<{ type: "ApplicationRejected"; applicationId: string; accountId: string; at: Date }>;

export type ApplicationError = DomainError<"invalid_details" | "missing_documents" | "invalid_wallet" | "not_editable" | "not_submitted" | "invalid_note">;

/** Handles are URL-safe: 3–30 lower-case letters, digits and single hyphens. */
export const HANDLE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/;
/** Words that would be confusing or abusable as a shop address. */
const RESERVED = new Set(["admin", "api", "lychee", "support", "help", "official", "sell", "shop", "store", "team", "staff", "security"]);
const EVM = /^0x[a-fA-F0-9]{40}$/;
const MAX_DOCUMENTS = 8;

const invalid = (message: string) => err(domainError("invalid_details", message));

export function newApplication(props: { id: string; accountId: string; at: Date }): Application {
  return {
    id: props.id,
    accountId: props.accountId,
    status: "draft",
    business: null,
    payoutWallet: null,
    documents: [],
    createdAt: props.at,
    submittedAt: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    sellerId: null,
  };
}

/** Drafts and rejected applications can be edited; a rejected one goes back to draft. */
const editable = (a: Application) => a.status === "draft" || a.status === "rejected";

export function checkBusiness(input: BusinessDetails): Result<BusinessDetails, ApplicationError> {
  const b: BusinessDetails = {
    ...input,
    name: input.name.trim(),
    handle: input.handle.trim().toLowerCase(),
    city: input.city.trim(),
    address: input.address.trim(),
    phone: input.phone.trim(),
    website: input.website?.trim() || null,
    description: input.description.trim(),
    country: input.country.trim().toUpperCase(),
  };
  if (b.name.length < 2 || b.name.length > 60) return invalid("Shop names are 2 to 60 characters.");
  if (!HANDLE.test(b.handle) || RESERVED.has(b.handle)) return invalid("Pick a shop address of 3 to 30 letters, numbers and hyphens.");
  if (!SELLER_KINDS.includes(b.kind)) return invalid("Pick what kind of business you are.");
  if (!/^[A-Z]{2}$/.test(b.country)) return invalid("Pick the country the business is registered in.");
  if (b.city.length < 2 || b.city.length > 80) return invalid("Add the city.");
  if (b.address.length < 5 || b.address.length > 300) return invalid("Add the business address.");
  if (!/^\+?[0-9 ()-]{7,20}$/.test(b.phone)) return invalid("Add a phone number with the country code.");
  if (b.website && (!/^https?:\/\/\S+\.\S+$/.test(b.website) || b.website.length > 200)) return invalid("The website should start with https://.");
  if (b.yearsInBusiness !== null && (!Number.isInteger(b.yearsInBusiness) || b.yearsInBusiness < 0 || b.yearsInBusiness > 200)) return invalid("Years in business should be a whole number.");
  if (b.description.length < 20 || b.description.length > 1000) return invalid("Describe the business in 20 to 1,000 characters.");
  return ok(b);
}

export function saveDetails(a: Application, business: BusinessDetails, payoutWallet: string | null): Result<Application, ApplicationError> {
  if (!editable(a)) return err(domainError("not_editable", "This application is being reviewed."));
  const checked = checkBusiness(business);
  if (!checked.ok) return checked;
  const wallet = payoutWallet?.trim() || null;
  if (wallet && !EVM.test(wallet)) return err(domainError("invalid_wallet", "The payout wallet should be a 0x… address that can receive USDC on Base."));
  return ok({ ...a, status: "draft", business: checked.value, payoutWallet: wallet, decisionNote: a.status === "rejected" ? a.decisionNote : null });
}

/** Adds a document, replacing an earlier one of the same kind (except "other"). */
export function attachDocument(a: Application, doc: KycDocument): Result<Application, ApplicationError> {
  if (!editable(a)) return err(domainError("not_editable", "This application is being reviewed."));
  const kept = doc.kind === "other" ? a.documents : a.documents.filter((d) => d.kind !== doc.kind);
  if (kept.length >= MAX_DOCUMENTS) return err(domainError("invalid_details", `Up to ${MAX_DOCUMENTS} documents.`));
  return ok({ ...a, status: "draft", documents: [...kept, doc] });
}

export function submit(a: Application, at: Date): Result<{ application: Application; event: ApplicationSubmitted }, ApplicationError> {
  if (!editable(a)) return err(domainError("not_editable", "This application is already submitted."));
  if (!a.business) return invalid("Add your business details first.");
  if (!a.payoutWallet) return err(domainError("invalid_wallet", "Add the wallet your payouts should go to."));
  const missing = REQUIRED_DOCUMENTS.filter((k) => !a.documents.some((d) => d.kind === k));
  if (missing.length) return err(domainError("missing_documents", `Still needed: ${missing.map(documentLabel).join(", ")}.`));
  return ok({
    application: { ...a, status: "submitted", submittedAt: at, decidedAt: null, decidedBy: null, decisionNote: null },
    event: { type: "ApplicationSubmitted", applicationId: a.id, accountId: a.accountId, at },
  });
}

export function approve(a: Application, reviewerId: string, sellerId: string, at: Date): Result<{ application: Application; event: ApplicationApproved }, ApplicationError> {
  if (a.status !== "submitted") return err(domainError("not_submitted", "Only submitted applications can be approved."));
  return ok({
    application: { ...a, status: "approved", decidedAt: at, decidedBy: reviewerId, decisionNote: null, sellerId },
    event: { type: "ApplicationApproved", applicationId: a.id, accountId: a.accountId, sellerId, at },
  });
}

export function reject(a: Application, reviewerId: string, note: string, at: Date): Result<{ application: Application; event: ApplicationRejected }, ApplicationError> {
  if (a.status !== "submitted") return err(domainError("not_submitted", "Only submitted applications can be rejected."));
  const reason = note.trim();
  if (reason.length < 10 || reason.length > 1000) return err(domainError("invalid_note", "Tell the applicant what to fix (10 to 1,000 characters)."));
  return ok({
    application: { ...a, status: "rejected", decidedAt: at, decidedBy: reviewerId, decisionNote: reason },
    event: { type: "ApplicationRejected", applicationId: a.id, accountId: a.accountId, at },
  });
}

export function documentLabel(kind: DocumentKind) {
  return { business_license: "business licence", id_front: "ID (front)", id_back: "ID (back)", selfie: "selfie holding the ID", other: "other document" }[kind];
}
