import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// Free samples for creators: a shop offers some units of a listing; a creator asks for one
// (with where to send it); the shop ships it with tracking, or declines and says why. The
// deal is a video: when the creator posts one featuring the product, the sample counts as
// posted. A sample not posted about within POST_WINDOW_DAYS of shipping lapses, and
// creators with LAPSE_LIMIT lapses can't ask for more.

export const POST_WINDOW_DAYS = 21;
export const OPEN_LIMIT = 3;
export const LAPSE_LIMIT = 2;

export type SampleOffer = Readonly<{ id: string; sellerId: string; slug: string; remaining: number; active: boolean; createdAt: Date }>;

export type ShippingAddress = Readonly<{ name: string; line1: string; line2: string; city: string; region: string; postcode: string; country: string }>;

export type SampleStatus = "requested" | "shipped" | "declined" | "posted" | "lapsed";

export type SampleRequest = Readonly<{
  id: string;
  offerId: string;
  sellerId: string;
  slug: string;
  creatorId: string;
  creatorName: string;
  address: ShippingAddress;
  note: string;
  status: SampleStatus;
  carrier: string | null;
  tracking: string | null;
  reason: string | null;
  videoId: string | null;
  requestedAt: Date;
  shippedAt: Date | null;
  closedAt: Date | null;
}>;

export type SampleEvent = Readonly<{ type: "SampleRequested" | "SampleShipped" | "SampleDeclined" | "SamplePosted"; requestId: string; sellerId: string; creatorId: string; slug: string; at: Date }>;

export type SampleError = DomainError<"invalid_offer" | "invalid_address" | "unavailable" | "too_many" | "not_allowed" | "invalid_tracking" | "not_found" | "invalid_state">;

export function offerSamples(props: { id: string; sellerId: string; slug: string; quantity: number; at: Date }): Result<SampleOffer, SampleError> {
  if (!Number.isInteger(props.quantity) || props.quantity < 1 || props.quantity > 500) return err(domainError("invalid_offer", "Offer 1 to 500 samples."));
  return ok({ id: props.id, sellerId: props.sellerId, slug: props.slug, remaining: props.quantity, active: true, createdAt: props.at });
}

const clean = (s: string, max: number) => s.trim().replace(/\s+/g, " ").slice(0, max);

export function checkAddress(a: ShippingAddress): Result<ShippingAddress, SampleError> {
  const address = { name: clean(a.name, 80), line1: clean(a.line1, 120), line2: clean(a.line2, 120), city: clean(a.city, 80), region: clean(a.region, 80), postcode: clean(a.postcode, 20), country: a.country.trim().toUpperCase() };
  if (address.name.length < 2 || address.line1.length < 3 || address.city.length < 2 || !/^[A-Z]{2}$/.test(address.country)) {
    return err(domainError("invalid_address", "Add your name, street, city and country so the shop can send it."));
  }
  return ok(address);
}

/** A creator's request; `history` is everything they asked for before. */
export function requestSample(
  offer: SampleOffer,
  props: { id: string; creator: { accountId: string; name: string }; address: ShippingAddress; note: string; runsShop: boolean; history: readonly SampleRequest[]; at: Date },
): Result<SampleRequest, SampleError> {
  if (!offer.active || offer.remaining < 1) return err(domainError("unavailable", "These samples have all been claimed."));
  if (props.runsShop) return err(domainError("not_allowed", "That's your own shop's sample."));
  if (props.history.some((r) => r.offerId === offer.id)) return err(domainError("not_allowed", "You've already asked for this one."));
  if (props.history.filter((r) => r.status === "lapsed").length >= LAPSE_LIMIT) return err(domainError("not_allowed", "Post about the samples you've had before asking for more."));
  if (props.history.filter((r) => r.status === "requested" || r.status === "shipped").length >= OPEN_LIMIT) {
    return err(domainError("too_many", `You can have ${OPEN_LIMIT} samples on the way at once.`));
  }
  const address = checkAddress(props.address);
  if (!address.ok) return address;
  return ok({
    id: props.id,
    offerId: offer.id,
    sellerId: offer.sellerId,
    slug: offer.slug,
    creatorId: props.creator.accountId,
    creatorName: props.creator.name,
    address: address.value,
    note: clean(props.note, 300),
    status: "requested",
    carrier: null,
    tracking: null,
    reason: null,
    videoId: null,
    requestedAt: props.at,
    shippedAt: null,
    closedAt: null,
  });
}

export function shipSample(r: SampleRequest, input: { carrier: string; tracking: string }, at: Date): Result<SampleRequest, SampleError> {
  if (r.status !== "requested") return err(domainError("invalid_state", "This request was already answered."));
  const carrier = clean(input.carrier, 40);
  const tracking = input.tracking.trim().toUpperCase();
  if (carrier.length < 2 || !/^[A-Z0-9-]{6,40}$/.test(tracking)) return err(domainError("invalid_tracking", "Add the carrier and a tracking number."));
  return ok({ ...r, status: "shipped", carrier, tracking, shippedAt: at });
}

export function declineSample(r: SampleRequest, reason: string, at: Date): Result<SampleRequest, SampleError> {
  if (r.status !== "requested") return err(domainError("invalid_state", "This request was already answered."));
  const why = clean(reason, 300);
  if (why.length < 5) return err(domainError("invalid_state", "Say why, so the creator knows."));
  return ok({ ...r, status: "declined", reason: why, closedAt: at });
}

/** The creator posted a video featuring the product. */
export const markPosted = (r: SampleRequest, videoId: string, at: Date): SampleRequest | null => (r.status === "shipped" ? { ...r, status: "posted", videoId, closedAt: at } : null);

export const lapsesAt = (r: SampleRequest) => (r.shippedAt ? new Date(r.shippedAt.getTime() + POST_WINDOW_DAYS * 86_400_000) : null);
