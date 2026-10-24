// "This or that?" polls: fixtures plus the one the shopper made on this device.
import { polls } from "@/fixtures/polls";
import type { Poll } from "@/lib/types";

export { polls };

export function getPoll(id: string) {
  return polls.find((p) => p.id === id);
}

/** A fresh poll from a set of products, with no votes yet. */
export function draftPoll(slugs: string[], question: string): Poll {
  return { id: "mine", by: "You", question, hoursLeft: 24, options: slugs.map((slug) => ({ slug, votes: 0, voters: [] })), comments: [] };
}

/** Friends who answer a shared poll in the demo, in order. */
export { chopHelpers as pollFriends } from "@/fixtures/chops";
