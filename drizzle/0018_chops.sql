CREATE TYPE "engagement"."chop_status" AS ENUM('open', 'done', 'expired', 'used');--> statement-breakpoint
CREATE TABLE "engagement"."chop_cuts" (
	"chop_id" text NOT NULL,
	"cutter" text NOT NULL,
	"name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "chop_cuts_chop_id_cutter_pk" PRIMARY KEY("chop_id","cutter")
);
--> statement-breakpoint
CREATE TABLE "engagement"."chop_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"full_price_cents" integer NOT NULL,
	"target_cents" integer NOT NULL,
	"cuts" integer NOT NULL,
	"hours" integer NOT NULL,
	"remaining" integer NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chop_offers_remaining" CHECK ("engagement"."chop_offers"."remaining" >= 0),
	CONSTRAINT "chop_offers_target" CHECK ("engagement"."chop_offers"."target_cents" > 0 and "engagement"."chop_offers"."target_cents" < "engagement"."chop_offers"."full_price_cents")
);
--> statement-breakpoint
CREATE TABLE "engagement"."chops" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"slug" text NOT NULL,
	"full_price_cents" integer NOT NULL,
	"target_cents" integer NOT NULL,
	"cuts" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "engagement"."chop_status" NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "chop_cuts_cutter_idx" ON "engagement"."chop_cuts" USING btree ("cutter","at");--> statement-breakpoint
CREATE INDEX "chop_offers_seller_idx" ON "engagement"."chop_offers" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "chops_owner_idx" ON "engagement"."chops" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "chops_open_idx" ON "engagement"."chops" USING btree ("ends_at") WHERE "engagement"."chops"."status" = 'open';--> statement-breakpoint
CREATE INDEX "chops_offer_idx" ON "engagement"."chops" USING btree ("offer_id");