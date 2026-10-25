CREATE TABLE "engagement"."poll_votes" (
	"poll_id" text NOT NULL,
	"voter" text NOT NULL,
	"name" text NOT NULL,
	"choice" integer NOT NULL,
	"reason" text,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "poll_votes_poll_id_voter_pk" PRIMARY KEY("poll_id","voter"),
	CONSTRAINT "poll_votes_choice" CHECK ("engagement"."poll_votes"."choice" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "engagement"."polls" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"question" text NOT NULL,
	"slugs" text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "polls_author_idx" ON "engagement"."polls" USING btree ("author_id","created_at");