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
export type { ClickRepository, CommissionRepository, CreatorRepository, ProgramRepository } from "./domain/repositories";
