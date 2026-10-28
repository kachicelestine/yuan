// Public surface of the ads context: sponsored listings, their auction, pacing and billing.
export { makeAds, type AdBilling, type AdProducts, type AdVideos, type Ads, type AdsDeps, type CampaignView, type Eligible, type Served, type TokenSigner } from "./application/ads";
export {
  auction,
  CLICK_WINDOW_MS,
  createCampaign,
  editCampaign,
  MAX_BID,
  MAX_BUDGET,
  MAX_PRODUCTS,
  MIN_BID,
  MIN_BUDGET,
  quality,
  shouldServe,
  type AdError,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
  type Candidate,
  type Win,
} from "./domain/ads";
export type { AdStatsRepository, CampaignRepository, DailyStats } from "./domain/repositories";
