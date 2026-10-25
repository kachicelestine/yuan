CREATE TYPE "engagement"."blind_box_state" AS ENUM('held', 'sold');--> statement-breakpoint
CREATE TABLE "engagement"."blind_boxes" (
	"case_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"buyer_id" uuid NOT NULL,
	"state" "engagement"."blind_box_state" NOT NULL,
	"held_until" timestamp with time zone,
	"order_id" uuid,
	"opened_at" timestamp with time zone,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "blind_boxes_case_id_index_pk" PRIMARY KEY("case_id","index")
);
--> statement-breakpoint
CREATE TABLE "engagement"."blind_cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"number" integer NOT NULL,
	"boxes" text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."blind_hints" (
	"case_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"buyer_id" uuid NOT NULL,
	"figure_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "blind_hints_case_id_index_buyer_id_figure_id_pk" PRIMARY KEY("case_id","index","buyer_id","figure_id")
);
--> statement-breakpoint
CREATE TABLE "engagement"."blind_series" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"poster" text NOT NULL,
	"figures" jsonb NOT NULL,
	"secret_odds" integer NOT NULL,
	"shakes_per_case" integer NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "blind_boxes_buyer_idx" ON "engagement"."blind_boxes" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "blind_boxes_order_idx" ON "engagement"."blind_boxes" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blind_cases_number_uq" ON "engagement"."blind_cases" USING btree ("series_id","number");