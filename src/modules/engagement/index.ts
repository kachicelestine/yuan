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
export type { ChopRepository, ClaimRepository, CoinRepository, CouponRepository, ListKind, ListRepository, PollRepository, RewardRepository, WatchRepository } from "./domain/repositories";
export { makePolls, type PollView, type Polls, type PollsDeps } from "./application/polls";
export { makeRewards, type ActivitySource, type MissionError, type Rewards, type RewardsDeps, type RewardsView } from "./application/rewards";
export { BADGES, EARLY_UNTIL, LEVELS, levelOf, MISSIONS, missionProgress, NO_ACTIVITY, type Activity, type Badge, type Mission } from "./domain/rewards";
export { makeChops, type ChopOfferView, type ChopProducts, type Chops, type ChopScope, type ChopsDeps, type ChopView } from "./application/chops";
export { canCut, CHOP_HOLD_MS, CUTS_PER_DAY, cutSize, heldPrice, makeOffer, priceAfter, startChop, type Chop, type ChopCompleted, type ChopCut, type ChopError, type ChopOffer, type ChopStatus } from "./domain/chop";
export { castVote, createPoll, isOpen, isPollId, MAX_REASON, POLL_HOURS, pollId, type Poll, type PollError, type PollVote } from "./domain/poll";
