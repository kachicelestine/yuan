CREATE SCHEMA "markets";
--> statement-breakpoint
CREATE TYPE "markets"."region" AS ENUM('Africa', 'Europe', 'Americas', 'Asia-Pacific', 'Middle East');--> statement-breakpoint
CREATE TABLE "markets"."countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" "markets"."region" NOT NULL,
	"city" text NOT NULL,
	"time_zone" text NOT NULL,
	"currency" char(3) NOT NULL,
	"calling_code" text,
	"vat_rate" numeric(6, 4),
	"vat_label" text NOT NULL,
	"shipping_cents" integer NOT NULL,
	"free_shipping_over_cents" integer NOT NULL,
	"extra_days" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets"."fx_rates" (
	"currency" char(3) PRIMARY KEY NOT NULL,
	"units_per_usd" numeric(24, 10) NOT NULL,
	"as_of" timestamp with time zone NOT NULL
);
