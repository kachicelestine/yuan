CREATE TYPE "engagement"."deposit_kind" AS ENUM('preorder', 'presale');--> statement-breakpoint
CREATE TYPE "engagement"."deposit_status" AS ENUM('pending', 'paid', 'converted', 'lapsed', 'forfeited', 'refunded');--> statement-breakpoint
CREATE TYPE "ordering"."order_kind" AS ENUM('goods', 'deposit');--> statement-breakpoint
CREATE TABLE "engagement"."deposit_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "engagement"."deposit_kind" NOT NULL,
	"title" text NOT NULL,
	"blurb" text NOT NULL,
	"deposit_cents" integer NOT NULL,
	"credit_cents" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"balance_from" timestamp with time zone NOT NULL,
	"balance_until" timestamp with time zone NOT NULL,
	"stock" integer NOT NULL,
	"per_person" integer NOT NULL,
	"taken" integer DEFAULT 0 NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "deposit_offers_taken" CHECK ("engagement"."deposit_offers"."taken" between 0 and "engagement"."deposit_offers"."stock")
);
--> statement-breakpoint
CREATE TABLE "engagement"."deposits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"offer_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"order_id" uuid,
	"status" "engagement"."deposit_status" NOT NULL,
	"final_order_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"reminded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ordering"."orders" ADD COLUMN "kind" "ordering"."order_kind" DEFAULT 'goods' NOT NULL;--> statement-breakpoint
CREATE INDEX "deposit_offers_seller_idx" ON "engagement"."deposit_offers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "deposits_buyer_idx" ON "engagement"."deposits" USING btree ("buyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_order_uq" ON "engagement"."deposits" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "deposits_final_idx" ON "engagement"."deposits" USING btree ("final_order_id");--> statement-breakpoint
CREATE INDEX "deposits_offer_idx" ON "engagement"."deposits" USING btree ("offer_id","status");