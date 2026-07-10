CREATE TABLE "petshop"."customer_auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"phone" varchar(20) NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_auth_customer_id_unique" UNIQUE("customer_id"),
	CONSTRAINT "customer_auth_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "petshop"."customer_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"uom_id" integer NOT NULL,
	"uom_code" varchar(10) NOT NULL,
	"qty" integer NOT NULL,
	"price_tier" varchar(20) NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	"subtotal_snapshot" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."customer_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"customer_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"estimated_total" integer NOT NULL,
	"converted_transaction_id" integer,
	"processed_by_id" integer,
	"processed_at" timestamp,
	"reject_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."customer_otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code_hash" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petshop"."customers" ADD COLUMN "default_tier_type" varchar(20) DEFAULT 'RETAIL' NOT NULL;--> statement-breakpoint
ALTER TABLE "petshop"."customers" ADD COLUMN "can_order_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "petshop"."products" ADD COLUMN "image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD COLUMN "source_order_id" integer;--> statement-breakpoint
ALTER TABLE "petshop"."customer_auth" ADD CONSTRAINT "customer_auth_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_order_items" ADD CONSTRAINT "customer_order_items_order_id_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "petshop"."customer_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_order_items" ADD CONSTRAINT "customer_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_order_items" ADD CONSTRAINT "customer_order_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_orders" ADD CONSTRAINT "customer_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_orders" ADD CONSTRAINT "customer_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_orders" ADD CONSTRAINT "customer_orders_converted_transaction_id_transactions_id_fk" FOREIGN KEY ("converted_transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_orders" ADD CONSTRAINT "customer_orders_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_order" ON "petshop"."customer_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_customer_orders_status_created" ON "petshop"."customer_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_orders_customer" ON "petshop"."customer_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_otp_phone" ON "petshop"."customer_otp_codes" USING btree ("phone");