import type { Campaign } from "./ads";

export type DailyStats = Readonly<{ impressions: number; clicks: number; spend: number }>;

export interface CampaignRepository {
  find(id: string): Promise<Campaign | null>;
  save(campaign: Campaign): Promise<void>;
  forSeller(sellerId: string): Promise<Campaign[]>;
  active(): Promise<Campaign[]>;
}

export interface AdStatsRepository {
  /** One more impression for each campaign, today. */
  addImpressions(campaignIds: readonly string[], day: string): Promise<void>;
  addClick(campaignId: string, day: string, spend: number): Promise<void>;
  /** Per campaign for one day. */
  day(campaignIds: readonly string[], day: string): Promise<Map<string, DailyStats>>;
  /** Per campaign over its life. */
  lifetime(campaignIds: readonly string[]): Promise<Map<string, DailyStats>>;
}
