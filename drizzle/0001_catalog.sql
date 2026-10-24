CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TYPE "catalog"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "catalog"."seller_kind" AS ENUM('Factory', 'Maker', 'Brand', 'Creator', 'Exporter');--> statement-breakpoint
CREATE TABLE "catalog"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"image" text NOT NULL,
	"hero" text NOT NULL,
	"blurb" text NOT NULL,
	"subcategories" text[] DEFAULT '{}' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"status" "catalog"."product_status" DEFAULT 'active' NOT NULL,
	"images" text[] NOT NULL,
	"price_cents" integer,
	"was_cents" integer,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_order" integer DEFAULT 1 NOT NULL,
	"rating" numeric(2, 1) DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"sold_count" integer,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlights" text[] DEFAULT '{}' NOT NULL,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"buyers_say" text,
	"ships_from" text NOT NULL,
	"lead_min_days" integer NOT NULL,
	"lead_max_days" integer NOT NULL,
	"duty_rate" numeric(5, 4) NOT NULL,
	"keywords" text DEFAULT '' NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "catalog"."products"."title"), 'A') || setweight(to_tsvector('english', "catalog"."products"."keywords"), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_price_positive" CHECK ("catalog"."products"."price_cents" is null or "catalog"."products"."price_cents" > 0),
	CONSTRAINT "products_min_order" CHECK ("catalog"."products"."min_order" >= 1),
	CONSTRAINT "products_lead_time" CHECK ("catalog"."products"."lead_min_days" >= 1 and "catalog"."products"."lead_max_days" >= "catalog"."products"."lead_min_days"),
	CONSTRAINT "products_duty_rate" CHECK ("catalog"."products"."duty_rate" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "catalog"."sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "catalog"."seller_kind" NOT NULL,
	"city" text NOT NULL,
	"avatar" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"audited" text,
	"years_in_business" integer,
	"storefront" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "catalog"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "catalog"."products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_seller_idx" ON "catalog"."products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "catalog"."products" USING gin ("search");