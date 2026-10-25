CREATE SCHEMA "messaging";
--> statement-breakpoint
CREATE TYPE "messaging"."side" AS ENUM('buyer', 'shop');--> statement-breakpoint
CREATE TABLE "messaging"."conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"seller_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_at" timestamp with time zone NOT NULL,
	"last_text" text NOT NULL,
	"last_from" "messaging"."side" NOT NULL,
	"buyer_read_at" timestamp with time zone,
	"shop_read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messaging"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"from" "messaging"."side" NOT NULL,
	"author_id" uuid NOT NULL,
	"text" text NOT NULL,
	"product_slug" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_uq" ON "messaging"."conversations" USING btree ("buyer_id","seller_id");--> statement-breakpoint
CREATE INDEX "conversations_buyer_idx" ON "messaging"."conversations" USING btree ("buyer_id","last_at");--> statement-breakpoint
CREATE INDEX "conversations_seller_idx" ON "messaging"."conversations" USING btree ("seller_id","last_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messaging"."messages" USING btree ("conversation_id","at");