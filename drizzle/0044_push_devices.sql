CREATE TABLE "notifications"."push_devices" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "push_devices_account_idx" ON "notifications"."push_devices" USING btree ("account_id","created_at");