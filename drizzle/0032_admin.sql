ALTER TYPE "catalog"."product_status" ADD VALUE 'removed';--> statement-breakpoint
ALTER TYPE "catalog"."product_status" ADD VALUE 'suspended';--> statement-breakpoint
CREATE TABLE "platform"."admin_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"note" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "catalog"."sellers" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalog"."sellers" ADD COLUMN "suspend_reason" text;--> statement-breakpoint
ALTER TABLE "identity"."accounts" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity"."accounts" ADD COLUMN "suspend_reason" text;--> statement-breakpoint
CREATE INDEX "admin_actions_at_idx" ON "platform"."admin_actions" USING btree ("at");--> statement-breakpoint
CREATE INDEX "admin_actions_target_idx" ON "platform"."admin_actions" USING btree ("target_type","target_id");