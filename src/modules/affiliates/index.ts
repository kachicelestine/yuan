// Public surface of the affiliates context: creator codes, shop programmes, clicks and commissions.
export {
  makeAffiliates,
  type Affiliates,
  type AffiliatesDeps,
  type AffiliatesScope,
  type CommissionView,
  type CreatorDashboard,
  type OrderSource,
  type ShopMembers,
  type ShopProgramView,
} from "./application/affiliates";
export {
  ATTRIBUTION_DAYS,
  commissionFor,
  DEFAULT_RATE,
  isCode,
  newCode,
  PROGRAM_RATES,
  setRate,
  settle,
  type AffiliateError,
  type Commission,
  type CommissionEarned,
  type CommissionStatus,
  type Creator,
  type Program,
} from "./domain/affiliate";
export type { ClickRepository, CommissionRepository, CreatorRepository, ProgramRepository, SampleRepository } from "./domain/repositories";
export { makeSamples, type SampleOfferView, type SampleRequestView, type Samples, type SampleScope, type SamplesDeps } from "./application/samples";
export { checkAddress, declineSample, LAPSE_LIMIT, markPosted, OPEN_LIMIT, offerSamples, POST_WINDOW_DAYS, requestSample, shipSample, type SampleError, type SampleEvent, type SampleOffer, type SampleRequest, type SampleStatus, type ShippingAddress } from "./domain/sample";
