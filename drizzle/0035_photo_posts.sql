ALTER TYPE "content"."report_target" ADD VALUE 'note';--> statement-breakpoint
ALTER TABLE "content"."notes" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "notes_author_idx" ON "content"."notes" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_tags_idx" ON "content"."notes" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "videos_tags_idx" ON "content"."videos" USING gin ("tags");