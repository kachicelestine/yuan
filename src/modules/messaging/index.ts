// Public surface of the messaging context: conversations between shoppers and shops.
export { makeMessaging, type ConversationView, type Messaging, type MessagingDeps, type MessagingScope, type MessageView, type Party } from "./application/messaging";
export { MAX_MESSAGE, startConversation, unreadFor, writeMessage, type Conversation, type Message, type MessageError, type MessageSent, type Side } from "./domain/conversation";
export type { ConversationRepository, MessageRepository } from "./domain/repositories";
