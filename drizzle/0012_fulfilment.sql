CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TYPE "ordering"."dispute_reason" AS ENUM('not_arrived', 'damaged', 'not_as_described', 'wrong_item', 'other');--> statement-breakpoint
CREATE TYPE "ordering"."shipment_status" AS ENUM('awaiting_shipment', 'shipped', 'delivered', 'disputed', 'refunded');--> statement-breakpoint
CREATE TYPE "payments"."disbursement_kind" AS ENUM('payout', 'refund');--> statement-breakpoint
CREATE TYPE "payments"."disbursement_status" AS ENUM('requested', 'sent', 'cancelled');--> statement-breakpoint
ALTER TYPE "ordering"."order_status" ADD VALUE 'completed';--> statement-breakpoint
CREATE TABLE "catalog"."applied_ratings" (
	"review_id" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ordering"."shipments" (
	"order_id" uuid NOT NULL,
	"seller_id" text NOT NULL,
	"status" "ordering"."shipment_status" NOT NULL,
	"amount_cents" integer NOT NULL,
	"carrier" text,
	"tracking" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"confirmed_by" text,
	"dispute_reason" "ordering"."dispute_reason",
	"dispute_note" text,
	"dispute_opened_at" timestamp with time zone,
	"resolution" text,
	"resolution_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "shipments_order_id_seller_id_pk" PRIMARY KEY("order_id","seller_id"),
	CONSTRAINT "shipments_amount" CHECK ("ordering"."shipments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments"."disbursements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "payments"."disbursement_kind" NOT NULL,
	"seller_id" text NOT NULL,
	"order_id" uuid,
	"account_id" uuid,
	"amount_cents" bigint NOT NULL,
	"address" text,
	"status" "payments"."disbursement_status" NOT NULL,
	"tx_hash" text,
	"note" text,
	"requested_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	CONSTRAINT "disbursements_amount" CHECK ("payments"."disbursements"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "ordering"."shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "ordering"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_once_uq" ON "notifications"."notifications" USING btree ("account_id","key");--> statement-breakpoint
CREATE INDEX "notifications_account_idx" ON "notifications"."notifications" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications"."notifications" USING btree ("account_id") WHERE "notifications"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "shipments_seller_idx" ON "ordering"."shipments" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "shipments_autoconfirm_idx" ON "ordering"."shipments" USING btree ("shipped_at") WHERE "ordering"."shipments"."status" = 'shipped';--> statement-breakpoint
CREATE INDEX "shipments_disputed_idx" ON "ordering"."shipments" USING btree ("dispute_opened_at") WHERE "ordering"."shipments"."status" = 'disputed';--> statement-breakpoint
CREATE INDEX "disbursements_pending_idx" ON "payments"."disbursements" USING btree ("requested_at") WHERE "payments"."disbursements"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "disbursements_seller_idx" ON "payments"."disbursements" USING btree ("seller_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "disbursements_refund_uq" ON "payments"."disbursements" USING btree ("order_id","seller_id") WHERE "payments"."disbursements"."kind" = 'refund';--> statement-breakpoint
CREATE UNIQUE INDEX "disbursements_tx_uq" ON "payments"."disbursements" USING btree ("tx_hash");--> statement-breakpoint
-- Orders paid before parcels existed get one per shop, waiting to ship.
INSERT INTO "ordering"."shipments" ("order_id", "seller_id", "status", "amount_cents") SELECT l."order_id", l."seller_id", 'awaiting_shipment', SUM(l."unit_price_cents" * l."qty") FROM "ordering"."order_lines" AS l JOIN "ordering"."orders" AS o ON o."id" = l."order_id" WHERE o."status" = 'paid' GROUP BY l."order_id", l."seller_id" ON CONFLICT DO NOTHING;
