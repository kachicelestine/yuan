CREATE TYPE "ordering"."gift_claimer" AS ENUM('recipient', 'sender');--> statement-breakpoint
CREATE TYPE "ordering"."gift_theme" AS ENUM('thanks', 'birthday', 'newyear', 'love');--> statement-breakpoint
CREATE TABLE "ordering"."gifts" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"from_name" text NOT NULL,
	"recipient_name" text NOT NULL,
	"theme" "ordering"."gift_theme" NOT NULL,
	"message" text NOT NULL,
	"hide_price" boolean NOT NULL,
	"choose_option" text,
	"choice" text,
	"claimed_at" timestamp with time zone,
	"claimed_by" "ordering"."gift_claimer",
	"thanks" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "gifts_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "ordering"."gifts" ADD CONSTRAINT "gifts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "ordering"."orders"("id") ON DELETE cascade ON UPDATE no action;