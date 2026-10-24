import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// A shop goes live: a host streams from their phone, pins products at a live price as they
// show them, answers questions in chat, and (for auctions) sells lots by bidding.

export const SHOW_KINDS = ["show", "tour", "auction"] as const;
export type ShowKind = (typeof SHOW_KINDS)[number];
export type ShowStatus = "scheduled" | "live" | "ended";
export type ItemStatus = "on-air" | "shown" | "next";

/** A product in the show. A live price, when set, is honoured at checkout while the show is on. */
export type ShowItem = Readonly<{ slug: string; livePrice: Cents | null; status: ItemStatus }>;

export type Show = Readonly<{
  id: string;
  sellerId: string;
  hostAccountId: string;
  hostName: string;
  title: string;
  kind: ShowKind;
  coverUrl: string;
  place: string;
  status: ShowStatus;
  scheduledFor: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  /** Secret the host's broadcaster presents to the media server. Never sent to viewers. */
  streamKey: string;
  items: readonly ShowItem[];
  /** A question the host pinned above the chat, with their answer. */
  pinned: Readonly<{ q: string; a: string }> | null;
  peakViewers: number;
}>;

export type ShowError = DomainError<"invalid_show" | "not_live" | "already_ended" | "unknown_item">;

export const MAX_ITEMS = 30;

export type ShowStarted = Readonly<{ type: "ShowStarted"; showId: string; sellerId: string; title: string; at: Date }>;
export type ShowEnded = Readonly<{ type: "ShowEnded"; showId: string; sellerId: string; at: Date }>;

const invalid = (message: string) => err(domainError("invalid_show", message));

export function scheduleShow(props: {
  id: string;
  sellerId: string;
  hostAccountId: string;
  hostName: string;
  title: string;
  kind: ShowKind;
  coverUrl: string;
  place: string;
  scheduledFor: Date;
  streamKey: string;
  items: readonly { slug: string; livePrice: Cents | null }[];
}): Result<Show, ShowError> {
  const title = props.title.trim();
  if (title.length < 3 || title.length > 100) return invalid("Give the show a title of 3 to 100 characters.");
  if (!SHOW_KINDS.includes(props.kind)) return invalid("Pick the kind of show.");
  if (props.items.length > MAX_ITEMS) return invalid(`Up to ${MAX_ITEMS} products per show.`);
  if (props.items.some((i) => i.livePrice !== null && i.livePrice <= 0)) return invalid("Live prices must be above zero.");
  const slugs = [...new Set(props.items.map((i) => i.slug))];
  const items = slugs.map((slug, i) => ({ slug, livePrice: props.items.find((x) => x.slug === slug)!.livePrice, status: (i === 0 ? "on-air" : "next") as ItemStatus }));
  return ok({
    id: props.id,
    sellerId: props.sellerId,
    hostAccountId: props.hostAccountId,
    hostName: props.hostName.trim().slice(0, 40) || "Host",
    title,
    kind: props.kind,
    coverUrl: props.coverUrl,
    place: props.place.trim().slice(0, 80),
    status: "scheduled",
    scheduledFor: props.scheduledFor,
    startedAt: null,
    endedAt: null,
    streamKey: props.streamKey,
    items,
    pinned: null,
    peakViewers: 0,
  });
}

export function goLive(s: Show, at: Date): Result<{ show: Show; event: ShowStarted | null }, ShowError> {
  if (s.status === "ended") return err(domainError("already_ended", "This show has ended. Schedule a new one."));
  if (s.status === "live") return ok({ show: s, event: null });
  return ok({ show: { ...s, status: "live", startedAt: at }, event: { type: "ShowStarted", showId: s.id, sellerId: s.sellerId, title: s.title, at } });
}

export function endShow(s: Show, at: Date): Result<{ show: Show; event: ShowEnded | null }, ShowError> {
  if (s.status === "ended") return ok({ show: s, event: null });
  return ok({ show: { ...s, status: "ended", endedAt: at }, event: { type: "ShowEnded", showId: s.id, sellerId: s.sellerId, at } });
}

/** Puts a product on air; whatever was on air before counts as shown. */
export function pin(s: Show, slug: string): Result<Show, ShowError> {
  if (s.status === "ended") return err(domainError("already_ended", "This show has ended."));
  if (!s.items.some((i) => i.slug === slug)) return err(domainError("unknown_item", "That product isn't in this show."));
  return ok({ ...s, items: s.items.map((i) => (i.slug === slug ? { ...i, status: "on-air" } : i.status === "on-air" ? { ...i, status: "shown" } : i)) });
}

export function pinQuestion(s: Show, q: string, a: string): Result<Show, ShowError> {
  const question = q.trim();
  const answer = a.trim();
  if (!question && !answer) return ok({ ...s, pinned: null });
  if (question.length > 200 || answer.length > 300 || !question || !answer) return invalid("Pin a question (up to 200 characters) with your answer (up to 300).");
  return ok({ ...s, pinned: { q: question, a: answer } });
}

/** The live price a viewer can hold right now: only while the show is on, only for its items. */
export function livePriceOf(s: Show, slug: string): Cents | null {
  if (s.status !== "live") return null;
  return s.items.find((i) => i.slug === slug)?.livePrice ?? null;
}
