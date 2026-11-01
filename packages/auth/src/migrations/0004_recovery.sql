CREATE TABLE "auth"."recovery_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."recovery_throttles" (
	"identifier" varchar(255) PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"lock_count" integer DEFAULT 0 NOT NULL,
	"first_lock_at" timestamp with time zone,
	"closed_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."recovery_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_tickets_token_valid" CHECK ("auth"."recovery_tickets"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "auth"."recovery_codes" ADD CONSTRAINT "recovery_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."recovery_codes" ADD CONSTRAINT "recovery_codes_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."recovery_tickets" ADD CONSTRAINT "recovery_tickets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_codes_one_live_per_account" ON "auth"."recovery_codes" USING btree ("account_id") WHERE "auth"."recovery_codes"."used_at" is null and "auth"."recovery_codes"."voided_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_tickets_token_unique" ON "auth"."recovery_tickets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "recovery_tickets_account_idx" ON "auth"."recovery_tickets" USING btree ("account_id");