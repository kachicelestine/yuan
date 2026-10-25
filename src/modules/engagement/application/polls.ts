import { domainError, err, ok, type Clock, type Result } from "@/shared/kernel";
import { castVote, createPoll, isOpen, isPollId, pollId, type Poll, type PollError, type PollVote } from "../domain/poll";
import type { PollRepository } from "../domain/repositories";

export type PollView = {
  id: string;
  by: string;
  question: string;
  endsAt: string;
  open: boolean;
  total: number;
  options: { slug: string; votes: number; voters: string[] }[];
  /** Reasons people gave, newest first. */
  comments: { name: string; text: string; pick: number; at: string }[];
  /** The viewer asked it. */
  yours: boolean;
  /** What the viewer picked, if they voted. */
  myVote: number | null;
};

export type PollsDeps = { polls: PollRepository; clock: Clock; newId?: () => string };

function toView(p: Poll, votes: readonly PollVote[], viewer: { voter: string | null; accountId: string | null }, now: Date): PollView {
  const newest = [...votes].sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    id: p.id,
    by: p.authorName,
    question: p.question,
    endsAt: p.endsAt.toISOString(),
    open: isOpen(p, now),
    total: votes.length,
    options: p.slugs.map((slug, i) => {
      const mine = newest.filter((v) => v.choice === i);
      return { slug, votes: mine.length, voters: mine.slice(0, 5).map((v) => v.name) };
    }),
    comments: newest
      .filter((v) => v.reason)
      .slice(0, 50)
      .map((v) => ({ name: v.name, text: v.reason!, pick: v.choice, at: v.at.toISOString() })),
    yours: viewer.accountId === p.authorId,
    myVote: viewer.voter ? (votes.find((v) => v.voter === viewer.voter)?.choice ?? null) : null,
  };
}

export function makePolls({ polls, clock, newId }: PollsDeps) {
  const makeId = newId ?? (() => pollId());

  return {
    async create(author: { accountId: string; name: string }, input: { question: string; slugs: readonly string[] }): Promise<Result<{ id: string }, PollError>> {
      for (let i = 0; i < 5; i++) {
        const p = createPoll({ id: makeId(), author, ...input, at: clock.now() });
        if (!p.ok) return p;
        if (await polls.create(p.value)) return ok({ id: p.value.id });
      }
      throw new Error("Could not allocate a poll id");
    },

    async view(id: string, viewer: { voter: string | null; accountId: string | null }): Promise<PollView | null> {
      if (!isPollId(id)) return null;
      const p = await polls.find(id);
      if (!p) return null;
      return toView(p, await polls.votes(id), viewer, clock.now());
    },

    async vote(id: string, v: { voter: string; accountId: string | null; name: string; choice: number; reason: string | null }): Promise<Result<PollView, PollError>> {
      const p = isPollId(id) ? await polls.find(id) : null;
      if (!p) return err(domainError("not_found", "No such poll."));
      const vote = castVote(p, { ...v, at: clock.now() });
      if (!vote.ok) return vote;
      await polls.vote(vote.value);
      return ok(toView(p, await polls.votes(id), { voter: v.voter, accountId: v.accountId }, clock.now()));
    },

    /** The polls someone asked, newest first. */
    async mine(accountId: string, limit = 10): Promise<{ id: string; question: string; open: boolean }[]> {
      const now = clock.now();
      return (await polls.byAuthor(accountId, limit)).map((p) => ({ id: p.id, question: p.question, open: isOpen(p, now) }));
    },
  };
}

export type Polls = ReturnType<typeof makePolls>;
