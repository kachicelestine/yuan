CREATE TYPE "content"."report_reason" AS ENUM('counterfeit', 'misleading', 'offensive', 'spam', 'unsafe', 'other');--> statement-breakpoint
CREATE TYPE "content"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "content"."report_target" AS ENUM('video', 'comment', 'question', 'review');--> statement-breakpoint
CREATE TABLE "content"."reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" "content"."report_target" NOT NULL,
	"target_id" text NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" "content"."report_reason" NOT NULL,
	"note" text,
	"status" "content"."report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reports_once_uq" ON "content"."reports" USING btree ("reporter_id","target_type","target_id") WHERE "content"."reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "content"."reports" USING btree ("target_type","target_id") WHERE "content"."reports"."status" = 'open';