CREATE TYPE "engagement"."drop_kind" AS ENUM('drop', 'restock');--> statement-breakpoint
CREATE TYPE "engagement"."promo_source" AS ENUM('drop', 'team');--> statement-breakpoint
CREATE TYPE "engagement"."team_status" AS ENUM('open', 'full', 'expired');--> statement-breakpoint
CREATE TABLE "engagement"."drops" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "engagement"."drop_kind" NOT NULL,
	"title" text NOT NULL,
	"blurb" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"price_cents" integer,
	"stock" integer,
	"per_person" integer NOT NULL,
	"claimed" integer DEFAULT 0 NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "drops_claimed" CHECK ("engagement"."drops"."claimed" >= 0 and ("engagement"."drops"."stock" is null or "engagement"."drops"."claimed" <= "engagement"."drops"."stock"))
);
--> statement-breakpoint
CREATE TABLE "engagement"."promo_holds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"price_cents" integer NOT NULL,
	"qty" integer NOT NULL,
	"source" "engagement"."promo_source" NOT NULL,
	"source_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "engagement"."reminders" (
	"key" text NOT NULL,
	"account_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"link" text NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "reminders_key_account_id_pk" PRIMARY KEY("key","account_id")
);
--> statement-breakpoint
CREATE TABLE "engagement"."team_members" (
	"team_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "team_members_team_id_account_id_pk" PRIMARY KEY("team_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "engagement"."team_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"full_price_cents" integer NOT NULL,
	"team_price_cents" integer NOT NULL,
	"size" integer NOT NULL,
	"hours" integer NOT NULL,
	"remaining" integer NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "team_offers_remaining" CHECK ("engagement"."team_offers"."remaining" >= 0)
);
--> statement-breakpoint
CREATE TABLE "engagement"."teams" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"leader_id" uuid NOT NULL,
	"leader_name" text NOT NULL,
	"team_price_cents" integer NOT NULL,
	"size" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "engagement"."team_status" NOT NULL,
	"full_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "drops_window_idx" ON "engagement"."drops" USING btree ("ends_at","starts_at");--> statement-breakpoint
CREATE INDEX "drops_seller_idx" ON "engagement"."drops" USING btree ("seller_id","starts_at");--> statement-breakpoint
CREATE INDEX "promo_holds_account_idx" ON "engagement"."promo_holds" USING btree ("account_id","slug");--> statement-breakpoint
CREATE INDEX "promo_holds_source_idx" ON "engagement"."promo_holds" USING btree ("source","source_id","account_id");--> statement-breakpoint
CREATE INDEX "promo_holds_lapse_idx" ON "engagement"."promo_holds" USING btree ("expires_at") WHERE "engagement"."promo_holds"."used_at" is null and "engagement"."promo_holds"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "engagement"."reminders" USING btree ("at") WHERE "engagement"."reminders"."sent_at" is null;--> statement-breakpoint
CREATE INDEX "team_members_account_idx" ON "engagement"."team_members" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "team_offers_seller_idx" ON "engagement"."team_offers" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "teams_open_idx" ON "engagement"."teams" USING btree ("offer_id","ends_at") WHERE "engagement"."teams"."status" = 'open';