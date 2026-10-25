CREATE TABLE "engagement"."board_follows" (
	"board_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "board_follows_board_id_account_id_pk" PRIMARY KEY("board_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "engagement"."boards" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"name" text NOT NULL,
	"slugs" text[] DEFAULT '{}' NOT NULL,
	"public" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "board_follows_account_idx" ON "engagement"."board_follows" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "boards_owner_idx" ON "engagement"."boards" USING btree ("owner_id","created_at");