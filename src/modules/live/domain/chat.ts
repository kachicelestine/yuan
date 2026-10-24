import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

export type ChatMessage = Readonly<{ id: string; showId: string; authorId: string; authorName: string; text: string; host: boolean; at: Date }>;

export type ChatError = DomainError<"invalid_message">;

export function writeMessage(props: Omit<ChatMessage, "text"> & { text: string }): Result<ChatMessage, ChatError> {
  const text = props.text.replace(/\s+/g, " ").trim();
  if (!text || text.length > 200) return err(domainError("invalid_message", "Messages are 1 to 200 characters."));
  return ok({ ...props, text });
}
