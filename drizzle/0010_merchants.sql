CREATE SCHEMA "merchants";
--> statement-breakpoint
CREATE TYPE "merchants"."application_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "merchants"."member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TABLE "merchants"."applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"status" "merchants"."application_status" NOT NULL,
	"business" jsonb,
	"handle" text,
	"payout_wallet" text,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"decision_note" text,
	"seller_id" text
);
--> statement-breakpoint
CREATE TABLE "merchants"."members" (
	"seller_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "merchants"."member_role" NOT NULL,
	"since" timestamp with time zone NOT NULL,
	CONSTRAINT "members_seller_id_account_id_pk" PRIMARY KEY("seller_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "content"."questions" ADD COLUMN "seller_id" text;--> statement-breakpoint
CREATE INDEX "applications_account_idx" ON "merchants"."applications" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "applications_queue_idx" ON "merchants"."applications" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_handle_uq" ON "merchants"."applications" USING btree ("handle") WHERE "merchants"."applications"."status" <> 'rejected';--> statement-breakpoint
CREATE INDEX "members_account_idx" ON "merchants"."members" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "questions_inbox_idx" ON "content"."questions" USING btree ("seller_id","created_at") WHERE "content"."questions"."answer" is null;--> statement-breakpoint
-- Existing questions belong to the shop selling the product.
UPDATE "content"."questions" AS q SET "seller_id" = p."seller_id" FROM "catalog"."products" AS p WHERE p."slug" = q."product_slug" AND q."seller_id" IS NULL;
