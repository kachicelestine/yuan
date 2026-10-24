CREATE SCHEMA "ordering";
--> statement-breakpoint
CREATE SCHEMA "payments";
--> statement-breakpoint
CREATE TYPE "ordering"."order_status" AS ENUM('awaiting_payment', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "ordering"."shipping_method" AS ENUM('standard', 'express');--> statement-breakpoint
CREATE TYPE "payments"."invoice_status" AS ENUM('pending', 'paid', 'expired');--> statement-breakpoint
CREATE TYPE "payments"."rail" AS ENUM('usdc-base', 'usdc-solana', 'usdt-tron');--> statement-breakpoint
CREATE TABLE "ordering"."order_lines" (
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"image" text NOT NULL,
	"seller_id" text NOT NULL,
	"option" text,
	"unit_price_cents" integer NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "order_lines_order_id_position_pk" PRIMARY KEY("order_id","position"),
	CONSTRAINT "order_lines_qty" CHECK ("ordering"."order_lines"."qty" >= 1)
);
--> statement-breakpoint
CREATE TABLE "ordering"."orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"status" "ordering"."order_status" NOT NULL,
	"country" char(2) NOT NULL,
	"shipping_method" "ordering"."shipping_method" NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"duty_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"due_at_door_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"parcels" integer NOT NULL,
	"coupon_id" text,
	"placed_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_total_non_negative" CHECK ("ordering"."orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments"."invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"rail" "payments"."rail" NOT NULL,
	"amount_cents" integer NOT NULL,
	"units" bigint NOT NULL,
	"pay_to" text NOT NULL,
	"status" "payments"."invoice_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"tx_hash" text,
	"late" boolean DEFAULT false NOT NULL,
	CONSTRAINT "invoices_orderId_unique" UNIQUE("order_id"),
	CONSTRAINT "invoices_txHash_unique" UNIQUE("tx_hash"),
	CONSTRAINT "invoices_amount_positive" CHECK ("payments"."invoices"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments"."journals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"memo" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "journals_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "payments"."ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_id" uuid NOT NULL,
	"account" text NOT NULL,
	"amount_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."simulated_transfers" (
	"invoice_id" uuid PRIMARY KEY NOT NULL,
	"units" bigint NOT NULL,
	"tx_hash" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordering"."order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "ordering"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."ledger_entries" ADD CONSTRAINT "ledger_entries_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "payments"."journals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_lines_seller_idx" ON "ordering"."order_lines" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "orders_placed_idx" ON "ordering"."orders" USING btree ("placed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_open_amount_uq" ON "payments"."invoices" USING btree ("pay_to","units") WHERE "payments"."invoices"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "payments"."invoices" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "payments"."ledger_entries" USING btree ("account");