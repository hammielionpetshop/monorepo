CREATE TABLE "auth"."account_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"app_code" varchar(50) NOT NULL,
	"local_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_links_app_code_valid" CHECK ("auth"."account_links"."app_code" <> '' AND "auth"."account_links"."app_code" = btrim("auth"."account_links"."app_code")),
	CONSTRAINT "account_links_local_user_positive" CHECK ("auth"."account_links"."local_user_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50),
	"email" varchar(255),
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"legacy_backoffice_user_id" integer,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_username_normalized" CHECK ("auth"."accounts"."username" IS NULL OR ("auth"."accounts"."username" <> '' AND "auth"."accounts"."username" = lower(btrim("auth"."accounts"."username", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')))),
	CONSTRAINT "accounts_email_normalized" CHECK ("auth"."accounts"."email" IS NULL OR ("auth"."accounts"."email" <> '' AND "auth"."accounts"."email" = lower(btrim("auth"."accounts"."email", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))))
);
--> statement-breakpoint
ALTER TABLE "auth"."account_links" ADD CONSTRAINT "account_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_links_account_app_unique" ON "auth"."account_links" USING btree ("account_id","app_code");--> statement-breakpoint
CREATE UNIQUE INDEX "account_links_app_local_user_unique" ON "auth"."account_links" USING btree ("app_code","local_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_unique" ON "auth"."accounts" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_unique" ON "auth"."accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_legacy_backoffice_user_unique" ON "auth"."accounts" USING btree ("legacy_backoffice_user_id");