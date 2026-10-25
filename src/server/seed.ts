import type { Database } from "@/shared/infrastructure/database";
import { seedAffiliates } from "@/modules/affiliates/infrastructure/seed";
import { seedCatalog } from "@/modules/catalog/infrastructure/seed";
import { seedContent } from "@/modules/content/infrastructure/seed";
import { seedBoards, seedChopOffers, seedEngagement, seedPromos } from "@/modules/engagement/infrastructure/seed";
import { seedLive } from "@/modules/live/infrastructure/seed";
import { seedMarkets } from "@/modules/markets/infrastructure/seed";

/** Loads reference and sample data into an empty database. Each seeder skips data that's already there. */
export async function seedAll(db: Database, now = new Date()) {
  return {
    markets: await seedMarkets(db),
    catalog: await seedCatalog(db),
    engagement: await seedEngagement(db),
    chops: await seedChopOffers(db),
    promos: await seedPromos(db, now),
    boards: await seedBoards(db, now),
    affiliates: await seedAffiliates(db, now),
    content: await seedContent(db),
    live: await seedLive(db),
  };
}
