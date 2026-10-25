CREATE TABLE "catalog"."price_points" (
	"slug" text NOT NULL,
	"day" date NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "price_points_slug_day_pk" PRIMARY KEY("slug","day")
);
--> statement-breakpoint
ALTER TABLE "engagement"."watches" ADD COLUMN "notified_cents" integer;