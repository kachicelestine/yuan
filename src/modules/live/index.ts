// Public surface of the live context: shows, chat, auctions and live price holds.
export { makeLive, toLotView, toMessageView, type Live, type LiveCatalog, type LiveDeps, type LiveError, type LiveScope, type LotView, type MediaUrls, type MessageView, type ShowView, type StudioView } from "./application/live";
export { closeLot, minimumBid, openLot, placeBid, SNIPE_WINDOW_MS, type Lot, type LotError, type LotSold, type LotStatus } from "./domain/auction";
export { writeMessage, type ChatError, type ChatMessage } from "./domain/chat";
export { holdHammerPrice, holdLivePrice, isActive, LIVE_HOLD_MS, LIVE_HOLD_QTY, LOT_HOLD_MS, type HoldSource, type PriceHold } from "./domain/hold";
export type { ChatRepository, HoldRepository, LiveBus, LiveSignal, LotRepository, ShowRepository } from "./domain/repositories";
export { endShow, goLive, livePriceOf, MAX_ITEMS, pin, pinQuestion, scheduleShow, SHOW_KINDS, type Show, type ShowEnded, type ShowError, type ShowItem, type ShowKind, type ShowStarted, type ShowStatus } from "./domain/show";
