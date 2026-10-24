// Fixture data for the design phase. Figure names are ours; the photos are stand-ins
// until the studio sends product shots.
import { square } from "@/lib/images";
import type { BlindBoxSeries } from "@/lib/types";

export const nightMarket: BlindBoxSeries = {
  id: "night-market-1",
  slug: "art-toy-blind-box",
  title: "Night Market",
  studio: "pals",
  poster: square("1774921689928-ee3e9c66f50b"),
  secretOdds: 144,
  figures: [
    { id: "rail-rabbit", name: "Rail Rabbit", image: square("1570805140270-9d3ce9325319", 0.5, 0.4) },
    { id: "lounge-lulu", name: "Lounge Lulu", image: square("1747205817398-771a62326a18", 0.65, 0.4) },
    { id: "sleepy-mochi", name: "Sleepy Mochi", image: square("1747205817629-b13eeb67ed34") },
    { id: "chess-club", name: "Chess Club", image: square("1747205817838-4943fef7b75a") },
    { id: "big-eyes-bao", name: "Big Eyes Bao", image: square("1750625565614-156eecb1dfeb") },
    { id: "little-rider", name: "Little Rider", image: square("1750750016116-7afaf28104d9") },
    { id: "lucky-red", name: "Lucky Red", image: square("1750753137215-613388194187") },
    { id: "bow-bow", name: "Bow Bow", image: square("1755445412789-b0efbda6d178") },
    { id: "night-twins", name: "Night Twins", image: square("1760007418582-331b744dc60f") },
    { id: "grumpy-gift", name: "Grumpy Gift", image: square("1769345749373-d1407c84cdbf") },
    { id: "jade-trio", name: "Jade Trio", image: square("1779792495476-d59e4f9a1c12") },
    { id: "gym-bun", name: "Gym Bun", image: square("1788270294693-50296e5b5715") },
    { id: "neon-pixel", name: "Neon Pixel", image: square("1781196208914-24e9fc9276aa", 0.5, 0.35), secret: true },
  ],
};

/**
 * The demo case: which figure sits in each of the 12 boxes. A full case never repeats a
 * figure; here the secret has replaced Bow Bow, as it does in 1 case in 12.
 */
export const demoCase = {
  number: "0412",
  boxes: ["chess-club", "gym-bun", "lucky-red", "rail-rabbit", "neon-pixel", "jade-trio", "sleepy-mochi", "little-rider", "grumpy-gift", "lounge-lulu", "big-eyes-bao", "night-twins"],
  /** Boxes other collectors already bought from this case. */
  taken: [2, 10],
  shakes: 3,
};
