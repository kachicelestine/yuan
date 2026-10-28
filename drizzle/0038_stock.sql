CREATE TABLE "catalog"."stock_holds" (
	"order_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"qty" integer NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "stock_holds_order_id_slug_pk" PRIMARY KEY("order_id","slug")
);
--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD COLUMN "stock" integer;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_stock" CHECK ("catalog"."products"."stock" is null or "catalog"."products"."stock" >= 0);