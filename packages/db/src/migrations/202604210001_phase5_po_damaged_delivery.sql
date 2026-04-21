CREATE TABLE "petshop"."po_receiving_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_item_id" integer NOT NULL,
	"log_id" integer NOT NULL,
	"qty_received" numeric(12, 2) NOT NULL,
	"qty_damaged" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expiry_date" timestamp,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "petshop"."supplier_payable_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payable_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" varchar(20) NOT NULL,
	"reference_number" varchar(100),
	"note" text,
	"paid_by_id" integer NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."damaged_goods" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"shift_id" integer,
	"reported_by_id" integer NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"reason" varchar(50) NOT NULL,
	"notes" text,
	"total_loss_value" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."damaged_goods_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"damaged_goods_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 2) NOT NULL,
	"loss_value" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."delivery_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"do_number" varchar(50) NOT NULL,
	"transaction_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"customer_address" text,
	"total_weight_gram" numeric(12, 2),
	"printed_by_id" integer NOT NULL,
	"printed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "delivery_orders_do_number_unique" UNIQUE("do_number")
);
--> statement-breakpoint
ALTER TABLE "petshop"."suppliers" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "petshop"."suppliers" ADD COLUMN "contact_person" varchar(100);--> statement-breakpoint
ALTER TABLE "petshop"."suppliers" ADD COLUMN "bank_account" varchar(100);--> statement-breakpoint
ALTER TABLE "petshop"."suppliers" ADD COLUMN "payment_term_days" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD COLUMN "qty_damaged" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD COLUMN "invoice_unit_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD COLUMN "expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "created_by_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "rejected_by_id" integer;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "rejection_note" text;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "invoice_number" varchar(100);--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD COLUMN "invoice_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD COLUMN "category_scope" jsonb;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD COLUMN "assigned_user_ids" jsonb;--> statement-breakpoint
ALTER TABLE "petshop"."po_receiving_items" ADD CONSTRAINT "po_receiving_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "petshop"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."po_receiving_items" ADD CONSTRAINT "po_receiving_items_log_id_po_receiving_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "petshop"."po_receiving_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."supplier_payable_payments" ADD CONSTRAINT "supplier_payable_payments_payable_id_supplier_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "petshop"."supplier_payables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."supplier_payable_payments" ADD CONSTRAINT "supplier_payable_payments_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods" ADD CONSTRAINT "damaged_goods_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods" ADD CONSTRAINT "damaged_goods_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods" ADD CONSTRAINT "damaged_goods_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods_items" ADD CONSTRAINT "damaged_goods_items_damaged_goods_id_damaged_goods_id_fk" FOREIGN KEY ("damaged_goods_id") REFERENCES "petshop"."damaged_goods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods_items" ADD CONSTRAINT "damaged_goods_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods_items" ADD CONSTRAINT "damaged_goods_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."delivery_orders" ADD CONSTRAINT "delivery_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."delivery_orders" ADD CONSTRAINT "delivery_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."delivery_orders" ADD CONSTRAINT "delivery_orders_printed_by_id_users_id_fk" FOREIGN KEY ("printed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_cashier_idx" ON "petshop"."shift_cashier_breakdown" USING btree ("shift_id","cashier_id");