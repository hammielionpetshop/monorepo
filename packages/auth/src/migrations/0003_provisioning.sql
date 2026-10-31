CREATE TABLE "auth"."provisioning_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"app_code" varchar(50) NOT NULL,
	"local_user_id" integer NOT NULL,
	"actor_account_id" integer,
	"account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "provisioning_requests_key_valid" CHECK ("auth"."provisioning_requests"."idempotency_key" ~ '^[A-Za-z0-9_.:-]{8,100}$'),
	CONSTRAINT "provisioning_requests_hash_valid" CHECK ("auth"."provisioning_requests"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "provisioning_requests_local_user_positive" CHECK ("auth"."provisioning_requests"."local_user_id" > 0)
);
--> statement-breakpoint
ALTER TABLE "auth"."provisioning_requests" ADD CONSTRAINT "provisioning_requests_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."provisioning_requests" ADD CONSTRAINT "provisioning_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "auth"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provisioning_requests_key_unique" ON "auth"."provisioning_requests" USING btree ("idempotency_key");