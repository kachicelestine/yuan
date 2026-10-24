import { Feed } from "@/components/feed/feed";
import { FIRST_PAGE, getFeedPage } from "@/server/feed";

export default async function ForYouPage() {
  // The first few slides render with the page; the feed fetches the rest as you swipe.
  return <Feed first={await getFeedPage(0, FIRST_PAGE)} />;
}
