CREATE TABLE "ads"."viewers" (
	"campaign_id" uuid NOT NULL,
	"day" date NOT NULL,
	"viewer" text NOT NULL,
	CONSTRAINT "viewers_campaign_id_day_viewer_pk" PRIMARY KEY("campaign_id","day","viewer")
);
--> statement-breakpoint
ALTER TABLE "ads"."campaigns" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;