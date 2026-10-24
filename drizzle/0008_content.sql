CREATE SCHEMA "content";
--> statement-breakpoint
CREATE TYPE "content"."like_target" AS ENUM('video', 'note', 'comment', 'question', 'review');--> statement-breakpoint
CREATE TYPE "content"."note_ratio" AS ENUM('tall', 'square', 'wide');--> statement-breakpoint
CREATE TYPE "content"."target_type" AS ENUM('video', 'note');--> statement-breakpoint
CREATE TYPE "content"."tone" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TYPE "content"."video_status" AS ENUM('processing', 'review', 'ready', 'failed', 'removed');--> statement-breakpoint
CREATE TABLE "content"."comments" (
	"id" text PRIMARY KEY NOT NULL,
	"target_type" "content"."target_type" NOT NULL,
	"target_id" text NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_avatar" text DEFAULT '' NOT NULL,
	"text" text NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"by_seller" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."likes" (
	"account_id" uuid NOT NULL,
	"target_type" "content"."like_target" NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "likes_account_id_target_type_target_id_pk" PRIMARY KEY("account_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "content"."notes" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_avatar" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"image_url" text NOT NULL,
	"ratio" "content"."note_ratio" NOT NULL,
	"product_slug" text,
	"category" text NOT NULL,
	"live" boolean DEFAULT false NOT NULL,
	"video" boolean DEFAULT false NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."questions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"asker_id" uuid,
	"asker_name" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"answered_by" text,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"seller_id" text NOT NULL,
	"order_id" uuid,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_avatar" text DEFAULT '' NOT NULL,
	"country" text NOT NULL,
	"rating" smallint NOT NULL,
	"text" text NOT NULL,
	"translated_from" text,
	"original" text,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"option" text,
	"helpful" integer DEFAULT 0 NOT NULL,
	"seller_reply" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviews_rating" CHECK ("content"."reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "content"."video_daily" (
	"video_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"watch_ms" bigint DEFAULT 0 NOT NULL,
	"completes" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "video_daily_video_id_day_pk" PRIMARY KEY("video_id","day")
);
--> statement-breakpoint
CREATE TABLE "content"."video_stats" (
	"video_id" text PRIMARY KEY NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"watch_ms" bigint DEFAULT 0 NOT NULL,
	"completes" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "video_stats_non_negative" CHECK ("content"."video_stats"."likes" >= 0 and "content"."video_stats"."comments" >= 0 and "content"."video_stats"."saves" >= 0 and "content"."video_stats"."shares" >= 0 and "content"."video_stats"."views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content"."videos" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" uuid,
	"seller_id" text NOT NULL,
	"product_slug" text NOT NULL,
	"also_slugs" text[] DEFAULT '{}' NOT NULL,
	"category" text NOT NULL,
	"spots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"poster_url" text DEFAULT '' NOT NULL,
	"renditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_key" text,
	"duration_ms" integer,
	"tone" "content"."tone" DEFAULT 'dark' NOT NULL,
	"caption" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"status" "content"."video_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content"."video_daily" ADD CONSTRAINT "video_daily_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "content"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."video_stats" ADD CONSTRAINT "video_stats_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "content"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "content"."comments" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_category_idx" ON "content"."notes" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "questions_product_idx" ON "content"."questions" USING btree ("product_slug","created_at");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "content"."reviews" USING btree ("product_slug","created_at");--> statement-breakpoint
CREATE INDEX "reviews_seller_idx" ON "content"."reviews" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_idx" ON "content"."reviews" USING btree ("order_id","product_slug");--> statement-breakpoint
CREATE INDEX "videos_ready_idx" ON "content"."videos" USING btree ("published_at") WHERE "content"."videos"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "videos_seller_idx" ON "content"."videos" USING btree ("seller_id","published_at");--> statement-breakpoint
CREATE INDEX "videos_category_idx" ON "content"."videos" USING btree ("category","published_at");