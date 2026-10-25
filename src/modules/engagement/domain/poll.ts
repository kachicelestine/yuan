import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// "This or that?": a shopper asks friends to pick between two or three products. Anyone
// with the link votes with one tap, no account needed, and can say why. Polls close after
// a day, so the asker gets an answer while they still want to buy.

export const POLL_HOURS = 24;
export const MAX_REASON = 200;

export type Poll = Readonly<{
  id: string;
  authorId: string;
  authorName: string;
  question: string;
  slugs: readonly string[];
  createdAt: Date;
  endsAt: Date;
}>;

export type PollVote = Readonly<{
  pollId: string;
  /** The voter's account id, or an anonymous id kept in their browser. */
  voter: string;
  name: string;
  choice: number;
  reason: string | null;
  at: Date;
}>;

export type PollError = DomainError<"invalid_poll" | "poll_closed" | "own_poll" | "invalid_choice" | "not_found">;

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** A short id for share links: /poll/k7m2qx9a. */
export function pollId(random: () => number = Math.random) {
  let id = "";
  for (let i = 0; i < 8; i++) id += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return id;
}
export const isPollId = (value: string) => /^[a-z2-9]{8}$/.test(value);

export function createPoll(props: { id: string; author: { accountId: string; name: string }; question: string; slugs: readonly string[]; at: Date }): Result<Poll, PollError> {
  const slugs = [...new Set(props.slugs)];
  if (slugs.length < 2 || slugs.length > 3) return err(domainError("invalid_poll", "Pick two or three products to choose between."));
  const question = props.question.trim().replace(/\s+/g, " ") || "Which one should I get?";
  if (question.length > 120) return err(domainError("invalid_poll", "Keep the question under 120 characters."));
  return ok({
    id: props.id,
    authorId: props.author.accountId,
    authorName: props.author.name,
    question,
    slugs,
    createdAt: props.at,
    endsAt: new Date(props.at.getTime() + POLL_HOURS * 3_600_000),
  });
}

export const isOpen = (poll: Poll, at: Date) => at.getTime() < poll.endsAt.getTime();

/** A vote, or a changed mind: voting again replaces the earlier vote while the poll is open. */
export function castVote(poll: Poll, v: { voter: string; accountId: string | null; name: string; choice: number; reason: string | null; at: Date }): Result<PollVote, PollError> {
  if (!isOpen(poll, v.at)) return err(domainError("poll_closed", "This poll has closed."));
  if (v.accountId && v.accountId === poll.authorId) return err(domainError("own_poll", "It's your poll: send it to friends to vote."));
  if (!Number.isInteger(v.choice) || v.choice < 0 || v.choice >= poll.slugs.length) return err(domainError("invalid_choice", "Pick one of the options."));
  const reason = v.reason?.trim().replace(/\s+/g, " ") || null;
  if (reason && reason.length > MAX_REASON) return err(domainError("invalid_choice", `Keep it under ${MAX_REASON} characters.`));
  return ok({ pollId: poll.id, voter: v.voter, name: v.name, choice: v.choice, reason, at: v.at });
}
