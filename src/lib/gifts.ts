// Gifting: card themes, the sample gift, and the wrap price.
import { giftThemes, sampleGift } from "@/fixtures/gifts";

export { giftThemes, sampleGift };

/** Gift wrap with a handwritten card, in USD. */
export const wrapPrice = 3;

export function getTheme(id: string) {
  return giftThemes.find((t) => t.id === id) ?? giftThemes[0];
}
