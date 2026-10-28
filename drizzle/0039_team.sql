CREATE TABLE "merchants"."invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "invitations_seller_idx" ON "merchants"."invitations" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "merchants"."invitations" USING btree ("email");