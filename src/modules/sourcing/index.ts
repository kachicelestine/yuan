// Public surface of the sourcing context: wholesale requests for quotes and shops' quotes.
export { makeSourcing, rfqCode, type QuoteView, type RfqView, type ShopRfqView, type Sourcing, type SourcingDeps, type SourcingScope } from "./application/sourcing";
export {
  acceptQuote,
  closeRfq,
  heldPrice,
  HOLD_DAYS,
  INCOTERMS,
  isOpen,
  MAX_OPEN,
  MAX_QTY,
  MAX_SHOPS,
  offerQuote,
  openRfq,
  quoteRange,
  RFQ_DAYS,
  withdrawQuote,
  type Incoterm,
  type Quote,
  type QuoteAccepted,
  type QuoteInput,
  type QuoteOffered,
  type Rfq,
  type RfqInput,
  type RfqOpened,
  type SourcingError,
} from "./domain/rfq";
export type { QuoteRepository, RfqRepository } from "./domain/repositories";
