// Gift card designs. The ids match the themes the ordering module accepts.
import type { GiftTheme as ThemeId } from "@/modules/ordering";

export type GiftTheme = { id: ThemeId; label: string; seal: string; bg: string };

export const giftThemes: GiftTheme[] = [
  { id: "thanks", label: "Thank you", seal: "谢谢", bg: "bg-[linear-gradient(150deg,#7fe0b4_0%,#1f6b52_100%)]" },
  { id: "birthday", label: "Birthday", seal: "生日快乐", bg: "bg-[linear-gradient(150deg,#c9b6ff_0%,#4a2f8f_100%)]" },
  { id: "newyear", label: "Lunar New Year", seal: "新年快乐", bg: "bg-[linear-gradient(150deg,#ff7a52_0%,#9c1f0c_100%)]" },
  { id: "love", label: "With love", seal: "爱", bg: "bg-[linear-gradient(150deg,#ff8fa8_0%,#a3123a_100%)]" },
];

export function getTheme(id: string) {
  return giftThemes.find((t) => t.id === id) ?? giftThemes[0];
}

type Option = { name: string; values: readonly { label: string; delta?: number }[] };

/** Options a gift's recipient may pick: two or more values that all cost the same, so the price can't change. */
export const choosable = (o: Option) => o.values.length > 1 && o.values.every((v) => (v.delta ?? 0) === (o.values[0].delta ?? 0));
