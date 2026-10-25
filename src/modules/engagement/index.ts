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
export type { BoardRepository, ChopRepository, ClaimRepository, DropRepository, PromoHold, PromoHoldRepository, Reminder, ReminderRepository, TeamRepository, CoinRepository, CouponRepository, ListKind, ListRepository, PollRepository, RewardRepository, WatchRepository } from "./domain/repositories";
export { makePolls, type PollView, type Polls, type PollsDeps } from "./application/polls";
export { makeBoards, type BoardView, type Boards, type BoardsDeps } from "./application/boards";
export { canSee, createBoard, editBoard, MAX_BOARD_ITEMS, MAX_BOARDS, toggleItem, type Board, type BoardError } from "./domain/board";
export { makePromos, type DropView, type PromoScope, type Promos, type PromosDeps, type TeamOfferView, type TeamView } from "./application/promos";
export { canClaim, canJoin, DROP_HOLD_MS, DROP_HOURS, dropState, makeTeamOffer, REMIND_BEFORE_MS, scheduleDrop, startTeam, TEAM_HOLD_MS, teamSaving, type Drop, type DropError, type DropKind, type DropState, type Team, type TeamError, type TeamFilled, type TeamMember, type TeamOffer, type TeamStatus } from "./domain/drop";
export { makeRewards, type ActivitySource, type MissionError, type Rewards, type RewardsDeps, type RewardsView } from "./application/rewards";
export { BADGES, EARLY_UNTIL, LEVELS, levelOf, MISSIONS, missionProgress, NO_ACTIVITY, type Activity, type Badge, type Mission } from "./domain/rewards";
export { makeChops, type ChopOfferView, type ChopProducts, type Chops, type ChopScope, type ChopsDeps, type ChopView } from "./application/chops";
export { canCut, CHOP_HOLD_MS, CUTS_PER_DAY, cutSize, heldPrice, makeOffer, priceAfter, startChop, type Chop, type ChopCompleted, type ChopCut, type ChopError, type ChopOffer, type ChopStatus } from "./domain/chop";
export { castVote, createPoll, isOpen, isPollId, MAX_REASON, POLL_HOURS, pollId, type Poll, type PollError, type PollVote } from "./domain/poll";
