CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "platform"."rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "platform"."schedules" (
	"name" text PRIMARY KEY NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "platform"."outbox" USING btree ("available_at") WHERE "platform"."outbox"."processed_at" is null and "platform"."outbox"."failed_at" is null;