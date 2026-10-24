-- Finishes 0005: category heroes and storefront covers also held Unsplash keys.
UPDATE "catalog"."categories"
SET "hero" = 'https://images.unsplash.com/' || "hero" || CASE WHEN position('?' in "hero") > 0 THEN '&' ELSE '?' END || 'w=1200&fm=jpg&q=80'
WHERE "hero" LIKE 'photo-%';
--> statement-breakpoint
UPDATE "catalog"."sellers"
SET "storefront" = jsonb_set(
  "storefront",
  '{cover}',
  to_jsonb('https://images.unsplash.com/' || ("storefront"->>'cover') || CASE WHEN position('?' in ("storefront"->>'cover')) > 0 THEN '&' ELSE '?' END || 'w=1200&fm=jpg&q=80')
)
WHERE "storefront"->>'cover' LIKE 'photo-%';
