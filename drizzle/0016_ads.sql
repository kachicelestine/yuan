CREATE SCHEMA "ads";
--> statement-breakpoint
CREATE TYPE "ads"."campaign_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "ads"."campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"slugs" text[] NOT NULL,
	"bid_cents" integer NOT NULL,
	"daily_budget_cents" integer NOT NULL,
	"status" "ads"."campaign_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "campaigns_bid" CHECK ("ads"."campaigns"."bid_cents" between 5 and 500),
	CONSTRAINT "campaigns_budget" CHECK ("ads"."campaigns"."daily_budget_cents" between 100 and 100000)
);
--> statement-breakpoint
CREATE TABLE "ads"."daily" (
	"campaign_id" uuid NOT NULL,
	"day" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_campaign_id_day_pk" PRIMARY KEY("campaign_id","day")
);
--> statement-breakpoint
CREATE INDEX "campaigns_seller_idx" ON "ads"."campaigns" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_active_idx" ON "ads"."campaigns" USING btree ("status") WHERE "ads"."campaigns"."status" = 'active';