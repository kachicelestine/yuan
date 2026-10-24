import type { Database } from "@/shared/infrastructure/database";
import { seedCatalog } from "@/modules/catalog/infrastructure/seed";
import { seedContent } from "@/modules/content/infrastructure/seed";
import { seedEngagement } from "@/modules/engagement/infrastructure/seed";
import { seedLive } from "@/modules/live/infrastructure/seed";
import { seedMarkets } from "@/modules/markets/infrastructure/seed";

/** Loads reference and sample data into an empty database. Each seeder skips data that's already there. */
export async function seedAll(db: Database) {
  return {
    markets: await seedMarkets(db),
    catalog: await seedCatalog(db),
    engagement: await seedEngagement(db),
    content: await seedContent(db),
    live: await seedLive(db),
  };
}
