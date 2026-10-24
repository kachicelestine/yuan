ALTER TABLE "content"."videos" ADD COLUMN "encode_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."videos" ADD COLUMN "encode_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content"."videos" ADD COLUMN "encode_error" text;--> statement-breakpoint
CREATE INDEX "videos_encode_idx" ON "content"."videos" USING btree ("created_at") WHERE "content"."videos"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "videos_author_idx" ON "content"."videos" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_source_idx" ON "content"."videos" USING btree ("source_key");