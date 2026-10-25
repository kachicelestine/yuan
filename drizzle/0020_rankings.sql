CREATE TABLE "catalog"."applied_sales" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement"."list_items" ADD COLUMN "added_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "list_items_added_idx" ON "engagement"."list_items" USING btree ("kind","added_at");