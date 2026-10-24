-- Images were stored as Unsplash keys ("photo-123?ar=1%3A1&fit=crop…") that a custom loader
-- turned into CDN URLs. They are now full URLs to a 1200 px rendition, which the loader resizes
-- per screen (see src/lib/images.ts). Rows that already hold a URL are untouched.
UPDATE "catalog"."categories"
SET "image" = 'https://images.unsplash.com/' || "image" || CASE WHEN position('?' in "image") > 0 THEN '&' ELSE '?' END || 'w=1200&fm=jpg&q=80'
WHERE "image" LIKE 'photo-%';
--> statement-breakpoint
UPDATE "catalog"."sellers"
SET "avatar" = 'https://images.unsplash.com/' || "avatar" || CASE WHEN position('?' in "avatar") > 0 THEN '&' ELSE '?' END || 'w=1200&fm=jpg&q=80'
WHERE "avatar" LIKE 'photo-%';
--> statement-breakpoint
UPDATE "catalog"."products"
SET "images" = ARRAY(
  SELECT CASE
    WHEN t.key LIKE 'photo-%' THEN 'https://images.unsplash.com/' || t.key || CASE WHEN position('?' in t.key) > 0 THEN '&' ELSE '?' END || 'w=1200&fm=jpg&q=80'
    ELSE t.key
  END
  FROM unnest("images") WITH ORDINALITY AS t(key, n)
  ORDER BY t.n
)
WHERE EXISTS (SELECT 1 FROM unnest("images") AS k WHERE k LIKE 'photo-%');
--> statement-breakpoint
UPDATE "ordering"."order_lines"
SET "image" = 'https://images.unsplash.com/' || "image" || CASE WHEN position('?' in "image") > 0 THEN '&' ELSE '?' END || 'w=1200&fm=jpg&q=80'
WHERE "image" LIKE 'photo-%';
