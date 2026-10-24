// Public surface of the engagement context.
export {
  makeEngagement,
  MAX_LIST,
  toCouponView,
  type CoinScope,
  type CouponView,
  type Engagement,
  type EngagementDeps,
  type EngagementSnapshot,
  type RedeemError,
  type WatchView,
} from "./application/engagement";
export { CHECKIN_REWARDS, checkinReward, checkinState, dayOf, type Checkin, type CoinEntry, type CoinReason, type Reward, type Watch } from "./domain/coins";
export { claim, isExpired, isUsable, type Claim, type Coupon, type CouponKind } from "./domain/coupon";
export type { ClaimRepository, CoinRepository, CouponRepository, ListKind, ListRepository, RewardRepository, WatchRepository } from "./domain/repositories";
