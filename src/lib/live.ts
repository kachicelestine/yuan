// Live shopping: rooms on air, the schedule, replays and the "just bought" feed.
import { livePurchases, liveReplays, liveRooms, liveSchedule } from "@/fixtures/live";

export { livePurchases, liveReplays, liveRooms, liveSchedule };

export function getLiveRoom(id: string) {
  return liveRooms.find((r) => r.id === id);
}

/** The top of the next hour plus `inHours`, so scheduled shows always sit in the future. */
export function showAt(inHours: number, now: number) {
  return Math.ceil(now / 3_600_000) * 3_600_000 + inHours * 3_600_000;
}
