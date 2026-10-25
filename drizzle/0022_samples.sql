CREATE TYPE "affiliates"."sample_status" AS ENUM('requested', 'shipped', 'declined', 'posted', 'lapsed');--> statement-breakpoint
CREATE TABLE "affiliates"."sample_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"remaining" integer NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sample_offers_remaining" CHECK ("affiliates"."sample_offers"."remaining" >= 0)
);
--> statement-breakpoint
CREATE TABLE "affiliates"."sample_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"offer_id" uuid NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"creator_id" uuid NOT NULL,
	"creator_name" text NOT NULL,
	"address" jsonb NOT NULL,
	"note" text NOT NULL,
	"status" "affiliates"."sample_status" NOT NULL,
	"carrier" text,
	"tracking" text,
	"reason" text,
	"video_id" text,
	"requested_at" timestamp with time zone NOT NULL,
	"shipped_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "sample_offers_seller_idx" ON "affiliates"."sample_offers" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sample_requests_once_uq" ON "affiliates"."sample_requests" USING btree ("offer_id","creator_id");--> statement-breakpoint
CREATE INDEX "sample_requests_creator_idx" ON "affiliates"."sample_requests" USING btree ("creator_id","requested_at");--> statement-breakpoint
CREATE INDEX "sample_requests_seller_idx" ON "affiliates"."sample_requests" USING btree ("seller_id","requested_at");--> statement-breakpoint
CREATE INDEX "sample_requests_shipped_idx" ON "affiliates"."sample_requests" USING btree ("shipped_at") WHERE "affiliates"."sample_requests"."status" = 'shipped';