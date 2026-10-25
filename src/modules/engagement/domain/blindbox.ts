import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// Blind boxes, sold one sealed box at a time from a real case. A case holds each regular
// figure once; with a published chance one box holds the secret figure instead, so every
// box has a 1-in-`secretOdds` chance of it. The arrangement is fixed when the case is made
// and never sent to the browser. Picking a box holds it while the buyer checks out (the
// box is the listing at its normal price); paying makes it theirs, and only then is it
// opened. Shaking a box rules out one figure it doesn't hold, a few times per case.

export const HOLD_MINUTES = 30;

export type Figure = Readonly<{ id: string; name: string; image: string; secret: boolean }>;

export type Series = Readonly<{
  id: string;
  sellerId: string;
  /** The listing a box is sold as. */
  slug: string;
  title: string;
  poster: string;
  figures: readonly Figure[];
  /** 1 in this many boxes holds the secret figure. */
  secretOdds: number;
  shakesPerCase: number;
  active: boolean;
  createdAt: Date;
}>;

export type Case = Readonly<{ id: string; seriesId: string; number: number; boxes: readonly string[]; createdAt: Date }>;

export type BoxState = "held" | "sold";
export type Box = Readonly<{ caseId: string; index: number; buyerId: string; state: BoxState; heldUntil: Date | null; orderId: string | null; openedAt: Date | null; at: Date }>;

export type BoxError = DomainError<"not_found" | "taken" | "hold_limit" | "no_shakes" | "not_yours" | "invalid_series">;

const regularsOf = (s: Series) => s.figures.filter((f) => !f.secret);
const secretOf = (s: Series) => s.figures.find((f) => f.secret) ?? null;

export function validSeries(s: Pick<Series, "figures" | "secretOdds" | "shakesPerCase">): Result<true, BoxError> {
  const regulars = s.figures.filter((f) => !f.secret);
  const secrets = s.figures.length - regulars.length;
  if (regulars.length < 2 || regulars.length > 24) return err(domainError("invalid_series", "A series needs 2 to 24 regular figures."));
  if (secrets > 1) return err(domainError("invalid_series", "A series has at most one secret figure."));
  if (new Set(s.figures.map((f) => f.id)).size !== s.figures.length) return err(domainError("invalid_series", "Each figure needs its own id."));
  if (secrets && (!Number.isInteger(s.secretOdds) || s.secretOdds < regulars.length)) return err(domainError("invalid_series", "The secret's odds must be at least 1 in the number of figures."));
  if (!Number.isInteger(s.shakesPerCase) || s.shakesPerCase < 0 || s.shakesPerCase > 5) return err(domainError("invalid_series", "Allow 0 to 5 shakes per case."));
  return ok(true);
}

/** A fresh case: every regular once, shuffled; with chance size/odds one box becomes the secret. */
export function makeCase(s: Series, id: string, number: number, random: () => number, at: Date): Case {
  const boxes = regularsOf(s).map((f) => f.id);
  for (let i = boxes.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [boxes[i], boxes[j]] = [boxes[j], boxes[i]];
  }
  const secret = secretOf(s);
  if (secret && random() < boxes.length / s.secretOdds) boxes[Math.floor(random() * boxes.length)] = secret.id;
  return { id, seriesId: s.id, number, boxes, createdAt: at };
}

/** Whether a box is free to pick: never sold, and not held by someone else right now. */
export const isFree = (box: Box | undefined, now: Date) => !box || (box.state === "held" && (box.heldUntil ?? now) <= now);

export function holdBox(p: { caseId: string; index: number; size: number; current: Box | undefined; buyerId: string; heldByBuyer: number; at: Date }): Result<Box, BoxError> {
  if (!Number.isInteger(p.index) || p.index < 0 || p.index >= p.size) return err(domainError("not_found", "No such box."));
  if (p.current?.buyerId === p.buyerId && p.current.state === "held" && (p.current.heldUntil ?? p.at) > p.at) return ok(p.current);
  if (!isFree(p.current, p.at)) return err(domainError("taken", "Someone else has that box. Pick another."));
  if (p.heldByBuyer >= 3) return err(domainError("hold_limit", "Check out the boxes you're holding first (three at a time)."));
  return ok({ caseId: p.caseId, index: p.index, buyerId: p.buyerId, state: "held", heldUntil: new Date(p.at.getTime() + HOLD_MINUTES * 60_000), orderId: null, openedAt: null, at: p.at });
}

/** One figure the box doesn't hold, not already ruled out (regular figures only, so the secret stays a surprise). */
export function shakeHint(s: Series, inside: string, ruledOut: readonly string[], random: () => number): string | null {
  const options = regularsOf(s).filter((f) => f.id !== inside && !ruledOut.includes(f.id));
  return options.length ? options[Math.floor(random() * options.length)].id : null;
}

/** Published odds per box: the secret 1 in `secretOdds`; each regular shares the rest. */
export function odds(s: Series) {
  const regulars = regularsOf(s).length;
  const secret = secretOf(s) ? 1 / s.secretOdds : 0;
  return { regular: (1 - secret) / regulars, secret };
}
