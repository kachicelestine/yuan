CREATE TABLE "platform"."ask_threads" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"turns" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
