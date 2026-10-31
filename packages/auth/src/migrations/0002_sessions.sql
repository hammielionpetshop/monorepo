CREATE TABLE "auth"."audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"actor_account_id" integer,
	"action" varchar(50) NOT NULL,
	"metadata" jsonb NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."login_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"app_code" varchar(50) NOT NULL,
	"auth_method" varchar(20) NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"device_label" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session_app_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"app_code" varchar(50) NOT NULL,
	"account_link_id" integer NOT NULL,
	"local_user_id" integer NOT NULL,
	"last_active_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(50),
	CONSTRAINT "session_app_access_app_valid" CHECK ("auth"."session_app_access"."app_code" IN ('backoffice', 'hris'))
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"auth_method" varchar(20) NOT NULL,
	"device_label" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(50),
	CONSTRAINT "sessions_auth_method_valid" CHECK ("auth"."sessions"."auth_method" IN ('PASSWORD', 'PIN')),
	CONSTRAINT "sessions_token_hash_valid" CHECK ("auth"."sessions"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "auth"."account_links" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "failed_login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD COLUMN "credentials_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."audit_events" ADD CONSTRAINT "audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."audit_events" ADD CONSTRAINT "audit_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."login_events" ADD CONSTRAINT "login_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session_app_access" ADD CONSTRAINT "session_app_access_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session_app_access" ADD CONSTRAINT "session_app_access_account_link_id_account_links_id_fk" FOREIGN KEY ("account_link_id") REFERENCES "auth"."account_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_account_time_idx" ON "auth"."audit_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_account_time_idx" ON "auth"."login_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_app_access_session_app_unique" ON "auth"."session_app_access" USING btree ("session_id","app_code");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "auth"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "auth"."sessions" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_failed_login_count_valid" CHECK ("auth"."accounts"."failed_login_count" >= 0 AND "auth"."accounts"."failed_login_count" <= 5);