import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Drops and team buys: two ways a shop sells at a better price for a while, with every
// rule fixed up front and nothing that resets. A drop opens at a set time, at a drop price
// (or just back in stock), with a fixed stock and a per-person limit; claiming one holds
// that price for 30 minutes. A team buy unlocks a team price once enough people join
// within the time limit; each member then holds that price for 48 hours. Nobody pays
// until checkout, so a drop that sells out or a team that doesn't fill costs nothing.

export const DROP_HOLD_MS = 30 * 60_000;
export const TEAM_HOLD_MS = 48 * 3_600_000;
export const DROP_HOURS = 24;
/** Reminders go out this long before something starts. */
export const REMIND_BEFORE_MS = 10 * 60_000;

export type DropKind = "drop" | "restock";

export type Drop = Readonly<{
  id: string;
  sellerId: string;
  slug: string;
  kind: DropKind;
  title: string;
  blurb: string;
  startsAt: Date;
  endsAt: Date;
  /** The drop price; null means the normal price (a restock). */
  price: Cents | null;
  /** How many are on offer at the drop price; null for a plain restock. */
  stock: number | null;
  perPerson: number;
  claimed: number;
  cancelled: boolean;
  createdAt: Date;
}>;

export type DropState = "upcoming" | "live" | "sold_out" | "ended";

export type DropError = DomainError<"invalid_drop" | "not_live" | "sold_out" | "limit_reached" | "not_found">;

export function scheduleDrop(props: {
  id: string;
  sellerId: string;
  slug: string;
  normalPrice: Cents;
  kind: DropKind;
  title: string;
  blurb: string;
  startsAt: Date;
  price: Cents | null;
  stock: number | null;
  perPerson: number;
  at: Date;
}): Result<Drop, DropError> {
  const lead = props.startsAt.getTime() - props.at.getTime();
  if (lead < 15 * 60_000 || lead > 60 * 86_400_000) return err(domainError("invalid_drop", "Schedule it between 15 minutes and 60 days from now."));
  const title = props.title.trim();
  if (title.length < 3 || title.length > 80) return err(domainError("invalid_drop", "Give it a title of 3 to 80 characters."));
  if (props.blurb.trim().length > 200) return err(domainError("invalid_drop", "Keep the description under 200 characters."));
  if (!Number.isInteger(props.perPerson) || props.perPerson < 1 || props.perPerson > 10) return err(domainError("invalid_drop", "Allow 1 to 10 per person."));
  if (props.kind === "drop") {
    if (props.price === null || !(props.price > 0 && props.price <= props.normalPrice * 0.95)) return err(domainError("invalid_drop", "A drop price must be at least 5% below the normal price."));
    if (props.stock === null || !Number.isInteger(props.stock) || props.stock < 1 || props.stock > 100_000) return err(domainError("invalid_drop", "Offer 1 to 100,000 at the drop price."));
  }
  return ok({
    id: props.id,
    sellerId: props.sellerId,
    slug: props.slug,
    kind: props.kind,
    title,
    blurb: props.blurb.trim(),
    startsAt: props.startsAt,
    endsAt: new Date(props.startsAt.getTime() + DROP_HOURS * 3_600_000),
    price: props.kind === "drop" ? props.price : null,
    stock: props.kind === "drop" ? props.stock : null,
    perPerson: props.perPerson,
    claimed: 0,
    cancelled: false,
    createdAt: props.at,
  });
}

export function dropState(d: Drop, at: Date): DropState {
  if (d.cancelled || at.getTime() >= d.endsAt.getTime()) return "ended";
  if (at.getTime() < d.startsAt.getTime()) return "upcoming";
  if (d.stock !== null && d.claimed >= d.stock) return "sold_out";
  return "live";
}

/** Whether someone may claim `qty` more now, having claimed `already`. */
export function canClaim(d: Drop, qty: number, already: number, at: Date): DropError | null {
  const state = dropState(d, at);
  if (state === "sold_out") return domainError("sold_out", "Every one at the drop price has been claimed.");
  if (state !== "live" || d.price === null) return domainError("not_live", "This drop isn't open right now.");
  if (!Number.isInteger(qty) || qty < 1 || already + qty > d.perPerson) return domainError("limit_reached", `It's ${d.perPerson} per person.`);
  return null;
}

export type TeamOffer = Readonly<{
  id: string;
  sellerId: string;
  slug: string;
  fullPrice: Cents;
  teamPrice: Cents;
  size: number;
  hours: number;
  /** Teams that can still be started. */
  remaining: number;
  active: boolean;
  createdAt: Date;
}>;

export type TeamStatus = "open" | "full" | "expired";

export type Team = Readonly<{
  id: string;
  offerId: string;
  slug: string;
  leaderId: string;
  leaderName: string;
  teamPrice: Cents;
  size: number;
  startedAt: Date;
  endsAt: Date;
  status: TeamStatus;
  fullAt: Date | null;
}>;

export type TeamMember = Readonly<{ teamId: string; accountId: string; name: string; at: Date }>;

export type TeamFilled = Readonly<{ type: "TeamFilled"; teamId: string; members: readonly string[]; slug: string; teamPrice: Cents; at: Date }>;

export type TeamError = DomainError<"invalid_offer" | "sold_out" | "team_closed" | "already_in" | "not_found">;

export function makeTeamOffer(props: { id: string; sellerId: string; slug: string; fullPrice: Cents; teamPrice: Cents; size: number; hours: number; teams: number; at: Date }): Result<TeamOffer, TeamError> {
  if (!Number.isInteger(props.size) || props.size < 2 || props.size > 10) return err(domainError("invalid_offer", "Teams of 2 to 10."));
  if (![12, 24, 48].includes(props.hours)) return err(domainError("invalid_offer", "Give teams 12, 24 or 48 hours to fill."));
  if (!Number.isInteger(props.teams) || props.teams < 1 || props.teams > 1000) return err(domainError("invalid_offer", "Allow 1 to 1,000 teams."));
  if (!(props.teamPrice > 0 && props.teamPrice <= props.fullPrice * 0.95)) return err(domainError("invalid_offer", "The team price must be at least 5% below the normal price."));
  return ok({ id: props.id, sellerId: props.sellerId, slug: props.slug, fullPrice: props.fullPrice, teamPrice: props.teamPrice, size: props.size, hours: props.hours, remaining: props.teams, active: true, createdAt: props.at });
}

export function startTeam(offer: TeamOffer, props: { id: string; leader: { accountId: string; name: string }; at: Date }): Result<Team, TeamError> {
  if (!offer.active) return err(domainError("invalid_offer", "This team buy isn't on offer any more."));
  if (offer.remaining < 1) return err(domainError("sold_out", "Every team for this one has been started."));
  return ok({
    id: props.id,
    offerId: offer.id,
    slug: offer.slug,
    leaderId: props.leader.accountId,
    leaderName: props.leader.name,
    teamPrice: offer.teamPrice,
    size: offer.size,
    startedAt: props.at,
    endsAt: new Date(props.at.getTime() + offer.hours * 3_600_000),
    status: "open",
    fullAt: null,
  });
}

export function canJoin(team: Team, accountId: string, members: readonly TeamMember[], at: Date): TeamError | null {
  if (team.status !== "open" || at.getTime() >= team.endsAt.getTime() || members.length >= team.size) return domainError("team_closed", "This team has closed.");
  if (members.some((m) => m.accountId === accountId)) return domainError("already_in", "You're already in this team.");
  return null;
}

/** "$3.40 off": what one saves at the team price. */
export const teamSaving = (o: Pick<TeamOffer, "fullPrice" | "teamPrice">) => money.cents(o.fullPrice - o.teamPrice);
