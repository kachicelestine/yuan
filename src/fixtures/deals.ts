// Fixture data for the design phase. Every name, price and count is illustrative.
import { avatar } from "@/lib/images";
import type { FlashDeal, TeamBuy } from "@/lib/types";

export const teamBuys: TeamBuy[] = [
  {
    slug: "longjing-first-flush",
    teamPrice: 18,
    size: 3,
    teams: [
      { leader: "Mei", avatar: avatar("1534751516642-a1af1ef26a56"), joined: [avatar("1616326431985-b9f89ebc6ab7", { fx: 0.47, fy: 0.17, zoom: 3.2 })], endsInSec: 20530 },
      { leader: "Kofi", avatar: avatar("1622626426572-c268eb006092"), joined: [], endsInSec: 40724 },
    ],
  },
  {
    slug: "art-toy-blind-box",
    teamPrice: 11,
    size: 4,
    teams: [{ leader: "Sora", avatar: avatar("1624091844772-554661d10173"), joined: [avatar("1513097633097-329a3a64e0d4"), avatar("1589525231707-f2de2428f59c")], endsInSec: 9140 }],
  },
];

/** Night deals end at 23:59 Beijing time (UTC+8) every day; the timer never resets mid-deal. */
export const flashDeals: FlashDeal[] = [
  { slug: "earbuds-anc", dealPrice: 19, claimed: 62 },
  { slug: "keyboard-75-retro", dealPrice: 48, claimed: 54 },
  { slug: "trainers-cloud-knit", dealPrice: 32, claimed: 35 },
  { slug: "lamp-brass-pendant", dealPrice: 22, claimed: 28 },
];

