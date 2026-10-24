CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"wallet" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "accounts_has_login" CHECK ("identity"."accounts"."email" is not null or "identity"."accounts"."wallet" is not null)
);
--> statement-breakpoint
CREATE TABLE "identity"."email_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "identity"."wallet_challenges" (
	"nonce" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"message" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
-- Orders placed before accounts existed have no buyer. They get the nil UUID, which no
-- account can have, so they stay in the database but are visible to no one.
ALTER TABLE "ordering"."orders" ADD COLUMN "buyer_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';--> statement-breakpoint
ALTER TABLE "ordering"."orders" ALTER COLUMN "buyer_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_uq" ON "identity"."accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_wallet_uq" ON "identity"."accounts" USING btree (lower("wallet"));--> statement-breakpoint
CREATE INDEX "email_challenges_email_idx" ON "identity"."email_challenges" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "identity"."sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "ordering"."orders" USING btree ("buyer_id","placed_at");