CREATE SCHEMA "affiliates";
--> statement-breakpoint
CREATE TYPE "affiliates"."commission_status" AS ENUM('pending', 'earned', 'void');--> statement-breakpoint
ALTER TYPE "payments"."disbursement_kind" ADD VALUE 'creator';--> statement-breakpoint
CREATE TABLE "affiliates"."clicks" (
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"day" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "clicks_code_day_slug_pk" PRIMARY KEY("code","day","slug")
);
--> statement-breakpoint
CREATE TABLE "affiliates"."commissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_id" text NOT NULL,
	"creator_id" uuid NOT NULL,
	"code" text NOT NULL,
	"base_cents" bigint NOT NULL,
	"rate" numeric(4, 3) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"slugs" text[] DEFAULT '{}' NOT NULL,
	"status" "affiliates"."commission_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "commissions_amount" CHECK ("affiliates"."commissions"."amount_cents" > 0 and "affiliates"."commissions"."amount_cents" <= "affiliates"."commissions"."base_cents")
);
--> statement-breakpoint
CREATE TABLE "affiliates"."creators" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"wallet" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates"."programs" (
	"seller_id" text PRIMARY KEY NOT NULL,
	"rate" numeric(4, 3) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "programs_rate" CHECK ("affiliates"."programs"."rate" between 0 and 0.3)
);
--> statement-breakpoint
ALTER TABLE "payments"."disbursements" ALTER COLUMN "seller_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ordering"."orders" ADD COLUMN "referral" text;--> statement-breakpoint
CREATE UNIQUE INDEX "commissions_order_seller_uq" ON "affiliates"."commissions" USING btree ("order_id","seller_id");--> statement-breakpoint
CREATE INDEX "commissions_creator_idx" ON "affiliates"."commissions" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE INDEX "commissions_seller_idx" ON "affiliates"."commissions" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_code_uq" ON "affiliates"."creators" USING btree ("code");--> statement-breakpoint
CREATE INDEX "disbursements_account_idx" ON "payments"."disbursements" USING btree ("account_id","requested_at");--> statement-breakpoint
ALTER TABLE "payments"."disbursements" ADD CONSTRAINT "disbursements_payee" CHECK (("payments"."disbursements"."kind"::text = 'creator' and "payments"."disbursements"."account_id" is not null) or ("payments"."disbursements"."kind"::text <> 'creator' and "payments"."disbursements"."seller_id" is not null));