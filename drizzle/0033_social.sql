CREATE SCHEMA "social";
--> statement-breakpoint
CREATE TABLE "social"."follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "follows_not_self" CHECK ("social"."follows"."follower_id" <> "social"."follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "social"."profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "profiles_handle" CHECK ("social"."profiles"."handle" ~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$')
);
--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "social"."follows" USING btree ("followee_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_idx" ON "social"."profiles" USING btree ("handle");