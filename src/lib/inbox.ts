// Inbox queries over the fixtures.
import { activity, autoReplies, fallbackReply, quickReplies, threads } from "@/fixtures/inbox";

export { activity, quickReplies, threads };

export function getThread(sellerId: string) {
  return threads.find((t) => t.sellerId === sellerId);
}

/** The seller's next message for what the shopper wrote (a canned reply until chat is live). */
export function sellerReply(text: string) {
  return autoReplies.find((r) => r.match.test(text)) ?? fallbackReply;
}
