CREATE SCHEMA "live";
--> statement-breakpoint
CREATE TYPE "live"."lot_status" AS ENUM('open', 'sold', 'unsold');--> statement-breakpoint
CREATE TYPE "live"."show_kind" AS ENUM('show', 'tour', 'auction');--> statement-breakpoint
CREATE TYPE "live"."show_status" AS ENUM('scheduled', 'live', 'ended');--> statement-breakpoint
CREATE TABLE "live"."chat_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"show_id" text NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"text" text NOT NULL,
	"host" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live"."holds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"price_cents" integer NOT NULL,
	"qty" integer NOT NULL,
	"source" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live"."lots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"show_id" text NOT NULL,
	"slug" text NOT NULL,
	"start_price_cents" integer NOT NULL,
	"increment_cents" integer NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "live"."lot_status" NOT NULL,
	"top_bid" jsonb,
	"bids" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live"."shows" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"host_account_id" uuid NOT NULL,
	"host_name" text NOT NULL,
	"title" text NOT NULL,
	"kind" "live"."show_kind" NOT NULL,
	"cover_url" text NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"status" "live"."show_status" NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"stream_key" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned" jsonb,
	"peak_viewers" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chat_show_idx" ON "live"."chat_messages" USING btree ("show_id","at");--> statement-breakpoint
CREATE INDEX "holds_account_idx" ON "live"."holds" USING btree ("account_id","slug");--> statement-breakpoint
CREATE INDEX "lots_show_idx" ON "live"."lots" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "lots_due_idx" ON "live"."lots" USING btree ("ends_at") WHERE "live"."lots"."status" = 'open';--> statement-breakpoint
CREATE INDEX "shows_status_idx" ON "live"."shows" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "shows_seller_idx" ON "live"."shows" USING btree ("seller_id","scheduled_for");