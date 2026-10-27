-- Every account that existed before profiles gets its default one, so links to people who
-- posted or commented earlier resolve. A handle clash (two ids ending alike) skips that
-- account; it gets the longer default the first time it's used.
INSERT INTO "social"."profiles" ("account_id", "handle", "name", "bio", "avatar", "created_at", "updated_at")
SELECT a."id",
       'shopper_' || right(replace(a."id"::text, '-', ''), 6),
       'shopper_' || right(replace(a."id"::text, '-', ''), 6),
       '', '', now(), now()
FROM "identity"."accounts" a
ON CONFLICT DO NOTHING;
