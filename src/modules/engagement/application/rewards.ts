import { domainError, err, ok, type Clock, type DomainError, type Result } from "@/shared/kernel";
import type { CoinRepository } from "../domain/repositories";
import { BADGES, levelOf, MISSIONS, missionProgress, NO_ACTIVITY, type Activity } from "../domain/rewards";

/** What someone has done, gathered from the contexts that know (orders, reviews, chops…). */
export interface ActivitySource {
  of(accountId: string): Promise<Activity>;
}

export type RewardsView = {
  /** Coins earned over time, which sets the level. */
  earned: number;
  level: ReturnType<typeof levelOf>;
  missions: { id: string; title: string; reward: number; goal: number; progress: number; href: string; claimed: boolean }[];
  badges: { id: string; name: string; detail: string; icon: string; earned: boolean }[];
};

export type RewardsDeps = { coins: CoinRepository; activity: ActivitySource; clock: Clock; newId: () => string };

export type MissionError = DomainError<"not_found" | "not_ready" | "claimed">;

function build(activity: Activity, earned: number, claimed: ReadonlySet<string>): RewardsView {
  return {
    earned,
    level: levelOf(earned),
    missions: MISSIONS.map((m) => ({ id: m.id, title: m.title, reward: m.reward, goal: m.goal, progress: missionProgress(m, activity), href: m.href, claimed: claimed.has(m.id) })),
    badges: BADGES.map((b) => ({ id: b.id, name: b.name, detail: b.detail, icon: b.icon, earned: b.earned(activity) })),
  };
}

export function makeRewards({ coins, activity, clock, newId }: RewardsDeps) {
  return {
    /** Missions and badges as they stand for this account, or for a visitor. */
    async view(accountId: string | null): Promise<RewardsView> {
      if (!accountId) return build(NO_ACTIVITY, 0, new Set());
      const [a, earned, claimed] = await Promise.all([activity.of(accountId), coins.earned(accountId), coins.refs(accountId, "mission")]);
      return build(a, earned, new Set(claimed));
    },

    /** Pays a mission's coins, once, if its goal has been reached. */
    async claim(accountId: string, missionId: string): Promise<Result<{ coins: number; view: RewardsView }, MissionError>> {
      const m = MISSIONS.find((x) => x.id === missionId);
      if (!m) return err(domainError("not_found", "No such mission."));
      const a = await activity.of(accountId);
      if (missionProgress(m, a) < m.goal) return err(domainError("not_ready", "Finish it first, then claim your coins."));
      if (!(await coins.credit({ id: newId(), accountId, amount: m.reward, reason: "mission", ref: m.id, at: clock.now() }))) {
        return err(domainError("claimed", "You've already claimed this one."));
      }
      const [balance, earned, claimed] = await Promise.all([coins.balance(accountId), coins.earned(accountId), coins.refs(accountId, "mission")]);
      return ok({ coins: balance, view: build(a, earned, new Set(claimed)) });
    },
  };
}

export type Rewards = ReturnType<typeof makeRewards>;
