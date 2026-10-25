CREATE SCHEMA "sourcing";
--> statement-breakpoint
CREATE TYPE "sourcing"."incoterm" AS ENUM('FOB', 'CIF', 'DDP');--> statement-breakpoint
CREATE TYPE "sourcing"."quote_status" AS ENUM('offered', 'accepted', 'withdrawn', 'declined');--> statement-breakpoint
CREATE TYPE "sourcing"."rfq_status" AS ENUM('open', 'ordered', 'closed');--> statement-breakpoint
CREATE TABLE "sourcing"."quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rfq_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"moq" integer NOT NULL,
	"lead_days" integer NOT NULL,
	"sample_cents" integer,
	"note" text NOT NULL,
	"status" "sourcing"."quote_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"hold_until" timestamp with time zone,
	"used_at" timestamp with time zone,
	CONSTRAINT "quotes_price" CHECK ("sourcing"."quotes"."unit_price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "sourcing"."rfqs" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"item" text NOT NULL,
	"details" text NOT NULL,
	"slug" text,
	"qty" integer NOT NULL,
	"target_cents" integer,
	"port" text NOT NULL,
	"incoterm" "sourcing"."incoterm" NOT NULL,
	"samples" boolean NOT NULL,
	"seller_ids" text[] NOT NULL,
	"status" "sourcing"."rfq_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rfqs_qty" CHECK ("sourcing"."rfqs"."qty" between 1 and 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_rfq_seller_uq" ON "sourcing"."quotes" USING btree ("rfq_id","seller_id");--> statement-breakpoint
CREATE INDEX "quotes_slug_idx" ON "sourcing"."quotes" USING btree ("slug") WHERE "sourcing"."quotes"."status" = 'accepted';--> statement-breakpoint
CREATE INDEX "rfqs_buyer_idx" ON "sourcing"."rfqs" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "rfqs_sellers_idx" ON "sourcing"."rfqs" USING gin ("seller_ids");--> statement-breakpoint
CREATE INDEX "rfqs_open_idx" ON "sourcing"."rfqs" USING btree ("closes_at") WHERE "sourcing"."rfqs"."status" = 'open';