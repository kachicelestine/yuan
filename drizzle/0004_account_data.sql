CREATE SCHEMA "engagement";
--> statement-breakpoint
CREATE TYPE "engagement"."coin_reason" AS ENUM('checkin', 'reward', 'adjustment');--> statement-breakpoint
CREATE TYPE "engagement"."coupon_kind" AS ENUM('amount', 'percent', 'free_shipping');--> statement-breakpoint
CREATE TYPE "engagement"."list_kind" AS ENUM('saved', 'alert');--> statement-breakpoint
CREATE TABLE "engagement"."coin_balances" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer NOT NULL,
	CONSTRAINT "coin_balances_balance" CHECK ("engagement"."coin_balances"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "engagement"."coin_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "engagement"."coin_reason" NOT NULL,
	"ref" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."coupon_claims" (
	"account_id" uuid NOT NULL,
	"coupon_id" text NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"order_id" uuid,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "coupon_claims_account_id_coupon_id_pk" PRIMARY KEY("account_id","coupon_id")
);
--> statement-breakpoint
CREATE TABLE "engagement"."coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "engagement"."coupon_kind" NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"min_spend_cents" integer NOT NULL,
	"seller_id" text,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "coupons_value" CHECK ("engagement"."coupons"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "engagement"."list_items" (
	"account_id" uuid NOT NULL,
	"kind" "engagement"."list_kind" NOT NULL,
	"slug" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "list_items_account_id_kind_slug_pk" PRIMARY KEY("account_id","kind","slug")
);
--> statement-breakpoint
CREATE TABLE "engagement"."rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"cost" integer NOT NULL,
	"coupon_id" text NOT NULL,
	CONSTRAINT "rewards_cost" CHECK ("engagement"."rewards"."cost" > 0)
);
--> statement-breakpoint
CREATE TABLE "engagement"."watches" (
	"account_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"target_cents" integer NOT NULL,
	"auto_buy" boolean DEFAULT false NOT NULL,
	CONSTRAINT "watches_account_id_slug_pk" PRIMARY KEY("account_id","slug"),
	CONSTRAINT "watches_target" CHECK ("engagement"."watches"."target_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "ordering"."cart_items" (
	"buyer_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"option" text DEFAULT '' NOT NULL,
	"qty" integer NOT NULL,
	"note" text,
	"position" integer NOT NULL,
	CONSTRAINT "cart_items_buyer_id_slug_option_pk" PRIMARY KEY("buyer_id","slug","option"),
	CONSTRAINT "cart_items_qty" CHECK ("ordering"."cart_items"."qty" >= 1)
);
--> statement-breakpoint
ALTER TABLE "engagement"."coupon_claims" ADD CONSTRAINT "coupon_claims_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "engagement"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement"."rewards" ADD CONSTRAINT "rewards_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "engagement"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_entries_once" ON "engagement"."coin_entries" USING btree ("account_id","reason","ref");--> statement-breakpoint
CREATE INDEX "coin_entries_account_idx" ON "engagement"."coin_entries" USING btree ("account_id","at");--> statement-breakpoint
CREATE INDEX "coupon_claims_order_idx" ON "engagement"."coupon_claims" USING btree ("order_id");