// Fixture data for the design phase. Card themes and a sample gift to unwrap.
import { people } from "@/fixtures/people";
import type { Gift, GiftTheme } from "@/lib/types";

export const giftThemes: GiftTheme[] = [
  { id: "thanks", label: "Thank you", seal: "谢谢", bg: "bg-[linear-gradient(150deg,#7fe0b4_0%,#1f6b52_100%)]" },
  { id: "birthday", label: "Birthday", seal: "生日快乐", bg: "bg-[linear-gradient(150deg,#c9b6ff_0%,#4a2f8f_100%)]" },
  { id: "newyear", label: "Lunar New Year", seal: "新年快乐", bg: "bg-[linear-gradient(150deg,#ff7a52_0%,#9c1f0c_100%)]" },
  { id: "love", label: "With love", seal: "爱", bg: "bg-[linear-gradient(150deg,#ff8fa8_0%,#a3123a_100%)]" },
];

/** What a friend abroad sees when the gift link opens. */
export const sampleGift: Gift = {
  id: "g-mei",
  slug: "teapot-zisha-180",
  from: "Mei",
  avatar: people.mia,
  to: "Ada",
  market: "NG",
  theme: "thanks",
  message: "For all the late-night calls. Brew something slow and think of Hangzhou.",
  hidePrice: true,
  theyChoose: true,
  wrap: true,
};
