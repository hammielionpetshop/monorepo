CREATE SCHEMA "petshop";
--> statement-breakpoint
CREATE TABLE "petshop"."branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"receipt_name" varchar(100) DEFAULT 'HAMMIELION' NOT NULL,
	"address" text,
	"phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "petshop"."owner_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "petshop"."role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "petshop"."roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "petshop"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_number" varchar(50),
	"email" varchar(255),
	"password_hash" text,
	"pin_hash" text,
	"name" varchar(100) NOT NULL,
	"role_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_staff_number_unique" UNIQUE("staff_number"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "petshop"."brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "petshop"."categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "petshop"."customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20),
	"name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "petshop"."expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "petshop"."payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	CONSTRAINT "payment_methods_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "petshop"."suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"contact_person" varchar(100),
	"bank_account" varchar(100),
	"address" text,
	"payment_term_days" integer DEFAULT 30
);
--> statement-breakpoint
CREATE TABLE "petshop"."units_of_measure" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	CONSTRAINT "units_of_measure_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "petshop"."product_barcodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"barcode" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_barcodes_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "petshop"."product_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"tier_type" varchar(20) NOT NULL,
	"price" integer NOT NULL,
	CONSTRAINT "product_prices_unique_tier" UNIQUE("product_id","branch_id","uom_id","tier_type")
);
--> statement-breakpoint
CREATE TABLE "petshop"."product_uom_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"ratio" integer NOT NULL,
	"weight_gram" integer,
	CONSTRAINT "product_uom_conversions_product_uom_unique" UNIQUE("product_id","uom_id")
);
--> statement-breakpoint
CREATE TABLE "petshop"."product_uom_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"cost_price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_uom_costs_unique_product_branch_uom" UNIQUE("product_id","branch_id","uom_id")
);
--> statement-breakpoint
CREATE TABLE "petshop"."products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50),
	"barcode" varchar(50),
	"name" varchar(255) NOT NULL,
	"category_id" integer,
	"brand_id" integer,
	"base_uom_id" integer NOT NULL,
	"weight_gram" integer,
	"default_cost_price" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "petshop"."product_stock_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty_received" integer NOT NULL,
	"qty_remaining" integer NOT NULL,
	"cost_price" integer NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "petshop"."product_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"adjusted_by_id" integer NOT NULL,
	"previous_qty" integer NOT NULL,
	"new_qty" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."stock_auto_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"from_uom_id" integer NOT NULL,
	"to_uom_id" integer NOT NULL,
	"qty_broken" integer NOT NULL,
	"qty_gained" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."open_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"shift_id" integer NOT NULL,
	"bill_name" varchar(100),
	"customer_id" integer,
	"items" jsonb NOT NULL,
	"total_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."transaction_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"product_id" integer,
	"product_name" varchar(255),
	"product_sku" varchar(50),
	"uom_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"total_price" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"price_tier" varchar(20) NOT NULL,
	"cogs" integer
);
--> statement-breakpoint
CREATE TABLE "petshop"."transaction_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"payment_method_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reference_number" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "petshop"."transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"trx_number" varchar(50) NOT NULL,
	"branch_id" integer NOT NULL,
	"shift_id" integer NOT NULL,
	"cashier_id" integer NOT NULL,
	"customer_id" integer,
	"total_amount" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"payable_amount" integer NOT NULL,
	"paid_amount" integer NOT NULL,
	"change_amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'COMPLETED' NOT NULL,
	"created_offline" boolean DEFAULT false NOT NULL,
	"offline_timestamp" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_trx_number_unique" UNIQUE("trx_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."shift_cashier_breakdown" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"cashier_id" integer NOT NULL,
	"total_sales_cash" integer DEFAULT 0 NOT NULL,
	"total_sales_qris" integer DEFAULT 0 NOT NULL,
	"total_sales_debit" integer DEFAULT 0 NOT NULL,
	"total_sales_credit" integer DEFAULT 0 NOT NULL,
	"total_sales_debt" integer DEFAULT 0 NOT NULL,
	"total_sales" integer DEFAULT 0 NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"total_expenses" integer DEFAULT 0 NOT NULL,
	"modal_share" integer,
	"expected_cash" integer,
	"real_cash" integer,
	"variance" integer,
	"is_variance_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."shift_cashier_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"cashier_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"stopped_at" timestamp,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."shift_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"cashier_id" integer NOT NULL,
	"category_id" integer,
	"category_custom" varchar(100),
	"amount" integer NOT NULL,
	"note" text NOT NULL,
	"proof_image" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"opened_by_id" integer NOT NULL,
	"shift_number" integer NOT NULL,
	"assigned_cashiers" jsonb NOT NULL,
	"opening_cash" integer NOT NULL,
	"target_end_time" timestamp,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_by_id" integer,
	"closed_at" timestamp,
	"total_closing_cash_real" integer,
	"total_closing_cash_expected" integer,
	"total_variance" integer,
	"settlement_notes" text,
	"force_closed_by_id" integer,
	"force_closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "petshop"."po_receiving_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_item_id" integer NOT NULL,
	"log_id" integer NOT NULL,
	"qty_received" integer NOT NULL,
	"qty_damaged" integer DEFAULT 0 NOT NULL,
	"expiry_date" timestamp,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "petshop"."po_receiving_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"received_by_id" integer NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"invoice_received" boolean DEFAULT false NOT NULL,
	"photo_urls" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "petshop"."purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty_ordered" integer NOT NULL,
	"qty_received" integer DEFAULT 0 NOT NULL,
	"qty_damaged" integer DEFAULT 0 NOT NULL,
	"unit_cost" integer NOT NULL,
	"invoice_unit_cost" integer,
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "petshop"."purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" varchar(50) NOT NULL,
	"po_type" varchar(20) DEFAULT 'EXTERNAL' NOT NULL,
	"branch_id" integer NOT NULL,
	"source_branch_id" integer,
	"supplier_id" integer,
	"status" varchar(30) DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"total_amount" integer NOT NULL,
	"created_by_id" integer NOT NULL,
	"approved_by_id" integer,
	"approved_at" timestamp,
	"rejected_by_id" integer,
	"rejected_at" timestamp,
	"rejection_note" text,
	"notes" text,
	"target_delivery_date" timestamp,
	"invoice_number" varchar(100),
	"invoice_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."supplier_payable_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payable_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"method" varchar(20) NOT NULL,
	"reference_number" varchar(100),
	"note" text,
	"paid_by_id" integer NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."supplier_payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp,
	"status" varchar(20) DEFAULT 'UNPAID' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."stock_opname_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"so_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"system_qty" integer NOT NULL,
	"physical_qty" integer NOT NULL,
	"variance_qty" integer NOT NULL,
	"variance_cost_value" integer,
	"variance_category" varchar(20),
	"variance_reason" text,
	"is_recounted" boolean DEFAULT false NOT NULL,
	"recount_physical_qty" integer
);
--> statement-breakpoint
CREATE TABLE "petshop"."stock_opnames" (
	"id" serial PRIMARY KEY NOT NULL,
	"so_number" varchar(50) NOT NULL,
	"branch_id" integer NOT NULL,
	"shift_id" integer,
	"type" varchar(20) NOT NULL,
	"method" varchar(20),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"category_scope" jsonb,
	"assigned_user_ids" jsonb,
	"skip_reason" text,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"created_by_id" integer NOT NULL,
	"approved_by_id" integer,
	"approved_at" timestamp,
	"rejected_by_id" integer,
	"rejected_at" timestamp,
	"rejection_note" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "stock_opnames_so_number_unique" UNIQUE("so_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(30) NOT NULL,
	"value" integer,
	"min_purchase" integer DEFAULT 0,
	"max_discount" integer,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "petshop"."customer_debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"transaction_id" integer,
	"branch_id" integer,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"remaining_amount" integer NOT NULL,
	"due_at" timestamp,
	"status" varchar(20) DEFAULT 'UNPAID' NOT NULL,
	"note" varchar(255),
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."debt_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"debt_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"payment_method_id" integer NOT NULL,
	"note" varchar(255),
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"voided_at" timestamp,
	"voided_by" integer,
	"void_reason" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "petshop"."customer_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_points_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "petshop"."point_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"transaction_id" integer,
	"type" varchar(20) NOT NULL,
	"points" integer NOT NULL,
	"note" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"table_name" varchar(50),
	"record_id" text,
	"old_data" text,
	"new_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."owner_price_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"override_by_id" integer NOT NULL,
	"original_price" integer NOT NULL,
	"overridden_price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."void_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"request_by_id" integer NOT NULL,
	"approved_by_id" integer,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"branch_id" integer,
	"title" varchar(150) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"total_loss_value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."damaged_goods_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"damaged_goods_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"cost_price" integer NOT NULL,
	"loss_value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."delivery_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"do_number" varchar(50) NOT NULL,
	"transaction_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"customer_address" text,
	"total_weight_gram" integer,
	"printed_by_id" integer NOT NULL,
	"printed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "delivery_orders_do_number_unique" UNIQUE("do_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"transaction_item_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"cogs" integer NOT NULL,
	"refund_amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" varchar(50) NOT NULL,
	"transaction_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"processed_by_id" integer NOT NULL,
	"reason" text NOT NULL,
	"total_refund_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"cancelled_by_id" integer,
	"cancel_reason" text,
	CONSTRAINT "returns_return_number_unique" UNIQUE("return_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."inter_branch_transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty_requested" integer NOT NULL,
	"qty_shipped" integer DEFAULT 0 NOT NULL,
	"qty_received" integer DEFAULT 0 NOT NULL,
	"receive_notes" text,
	"cost_price_at_transfer" integer DEFAULT 0 NOT NULL,
	"expiry_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."inter_branch_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"ibt_number" varchar(50) NOT NULL,
	"source_branch_id" integer NOT NULL,
	"destination_branch_id" integer NOT NULL,
	"requested_by_id" integer NOT NULL,
	"approved_by_id" integer,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"total_transfer_value" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inter_branch_transfers_ibt_number_unique" UNIQUE("ibt_number")
);
--> statement-breakpoint
CREATE TABLE "petshop"."inter_branch_payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"debtor_branch_id" integer NOT NULL,
	"creditor_branch_id" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'UNPAID' NOT NULL,
	"notes" text,
	"due_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."inter_branch_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payable_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"paid_by_user_id" integer,
	"reference_number" varchar(100),
	"notes" text,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petshop"."cash_flow_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cash_flow_categories_name_type_unique" UNIQUE("name","type")
);
--> statement-breakpoint
CREATE TABLE "petshop"."cash_flow_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(10) NOT NULL,
	"category_id" integer NOT NULL,
	"branch_id" integer,
	"amount" integer NOT NULL,
	"note" varchar(255),
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petshop"."owner_assignments" ADD CONSTRAINT "owner_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."owner_assignments" ADD CONSTRAINT "owner_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."owner_assignments" ADD CONSTRAINT "owner_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "petshop"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "petshop"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "petshop"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_prices" ADD CONSTRAINT "product_prices_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_uom_costs" ADD CONSTRAINT "product_uom_costs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_uom_costs" ADD CONSTRAINT "product_uom_costs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_uom_costs" ADD CONSTRAINT "product_uom_costs_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "petshop"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "petshop"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."products" ADD CONSTRAINT "products_base_uom_id_units_of_measure_id_fk" FOREIGN KEY ("base_uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_stock_batches" ADD CONSTRAINT "product_stock_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_stock_batches" ADD CONSTRAINT "product_stock_batches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_stock_batches" ADD CONSTRAINT "product_stock_batches_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_stocks" ADD CONSTRAINT "product_stocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_stocks" ADD CONSTRAINT "product_stocks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."product_stocks" ADD CONSTRAINT "product_stocks_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_adjusted_by_id_users_id_fk" FOREIGN KEY ("adjusted_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_auto_breaks" ADD CONSTRAINT "stock_auto_breaks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_auto_breaks" ADD CONSTRAINT "stock_auto_breaks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_auto_breaks" ADD CONSTRAINT "stock_auto_breaks_from_uom_id_units_of_measure_id_fk" FOREIGN KEY ("from_uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_auto_breaks" ADD CONSTRAINT "stock_auto_breaks_to_uom_id_units_of_measure_id_fk" FOREIGN KEY ("to_uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."open_bills" ADD CONSTRAINT "open_bills_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."open_bills" ADD CONSTRAINT "open_bills_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_items" ADD CONSTRAINT "transaction_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_items" ADD CONSTRAINT "transaction_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_payments" ADD CONSTRAINT "transaction_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_payments" ADD CONSTRAINT "transaction_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "petshop"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD CONSTRAINT "transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD CONSTRAINT "transactions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_cashier_breakdown" ADD CONSTRAINT "shift_cashier_breakdown_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_cashier_breakdown" ADD CONSTRAINT "shift_cashier_breakdown_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_cashier_sessions" ADD CONSTRAINT "shift_cashier_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_cashier_sessions" ADD CONSTRAINT "shift_cashier_sessions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_expenses" ADD CONSTRAINT "shift_expenses_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_expenses" ADD CONSTRAINT "shift_expenses_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shift_expenses" ADD CONSTRAINT "shift_expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "petshop"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shifts" ADD CONSTRAINT "shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shifts" ADD CONSTRAINT "shifts_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shifts" ADD CONSTRAINT "shifts_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."shifts" ADD CONSTRAINT "shifts_force_closed_by_id_users_id_fk" FOREIGN KEY ("force_closed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."po_receiving_items" ADD CONSTRAINT "po_receiving_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "petshop"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."po_receiving_items" ADD CONSTRAINT "po_receiving_items_log_id_po_receiving_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "petshop"."po_receiving_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."po_receiving_logs" ADD CONSTRAINT "po_receiving_logs_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "petshop"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."po_receiving_logs" ADD CONSTRAINT "po_receiving_logs_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "petshop"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_source_branch_id_branches_id_fk" FOREIGN KEY ("source_branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "petshop"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."purchase_orders" ADD CONSTRAINT "purchase_orders_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."supplier_payable_payments" ADD CONSTRAINT "supplier_payable_payments_payable_id_supplier_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "petshop"."supplier_payables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."supplier_payable_payments" ADD CONSTRAINT "supplier_payable_payments_paid_by_id_users_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."supplier_payables" ADD CONSTRAINT "supplier_payables_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "petshop"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."supplier_payables" ADD CONSTRAINT "supplier_payables_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "petshop"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opname_items" ADD CONSTRAINT "stock_opname_items_so_id_stock_opnames_id_fk" FOREIGN KEY ("so_id") REFERENCES "petshop"."stock_opnames"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opname_items" ADD CONSTRAINT "stock_opname_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD CONSTRAINT "stock_opnames_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD CONSTRAINT "stock_opnames_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD CONSTRAINT "stock_opnames_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD CONSTRAINT "stock_opnames_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_opnames" ADD CONSTRAINT "stock_opnames_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_debts" ADD CONSTRAINT "customer_debts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_debts" ADD CONSTRAINT "customer_debts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_debts" ADD CONSTRAINT "customer_debts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_debts" ADD CONSTRAINT "customer_debts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."debt_payments" ADD CONSTRAINT "debt_payments_debt_id_customer_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "petshop"."customer_debts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."debt_payments" ADD CONSTRAINT "debt_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "petshop"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."debt_payments" ADD CONSTRAINT "debt_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."debt_payments" ADD CONSTRAINT "debt_payments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_points" ADD CONSTRAINT "customer_points_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."point_transactions" ADD CONSTRAINT "point_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."point_transactions" ADD CONSTRAINT "point_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."owner_price_overrides" ADD CONSTRAINT "owner_price_overrides_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."owner_price_overrides" ADD CONSTRAINT "owner_price_overrides_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."owner_price_overrides" ADD CONSTRAINT "owner_price_overrides_override_by_id_users_id_fk" FOREIGN KEY ("override_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."void_requests" ADD CONSTRAINT "void_requests_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."void_requests" ADD CONSTRAINT "void_requests_request_by_id_users_id_fk" FOREIGN KEY ("request_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."void_requests" ADD CONSTRAINT "void_requests_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods" ADD CONSTRAINT "damaged_goods_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods" ADD CONSTRAINT "damaged_goods_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "petshop"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods" ADD CONSTRAINT "damaged_goods_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods_items" ADD CONSTRAINT "damaged_goods_items_damaged_goods_id_damaged_goods_id_fk" FOREIGN KEY ("damaged_goods_id") REFERENCES "petshop"."damaged_goods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods_items" ADD CONSTRAINT "damaged_goods_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."damaged_goods_items" ADD CONSTRAINT "damaged_goods_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."delivery_orders" ADD CONSTRAINT "delivery_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."delivery_orders" ADD CONSTRAINT "delivery_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."delivery_orders" ADD CONSTRAINT "delivery_orders_printed_by_id_users_id_fk" FOREIGN KEY ("printed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "petshop"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_transaction_item_id_transaction_items_id_fk" FOREIGN KEY ("transaction_item_id") REFERENCES "petshop"."transaction_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ADD CONSTRAINT "return_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."returns" ADD CONSTRAINT "returns_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfer_items" ADD CONSTRAINT "inter_branch_transfer_items_transfer_id_inter_branch_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "petshop"."inter_branch_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfer_items" ADD CONSTRAINT "inter_branch_transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfer_items" ADD CONSTRAINT "inter_branch_transfer_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_source_branch_id_branches_id_fk" FOREIGN KEY ("source_branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_destination_branch_id_branches_id_fk" FOREIGN KEY ("destination_branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_transfers" ADD CONSTRAINT "inter_branch_transfers_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_payables" ADD CONSTRAINT "inter_branch_payables_transfer_id_inter_branch_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "petshop"."inter_branch_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_payables" ADD CONSTRAINT "inter_branch_payables_debtor_branch_id_branches_id_fk" FOREIGN KEY ("debtor_branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_payables" ADD CONSTRAINT "inter_branch_payables_creditor_branch_id_branches_id_fk" FOREIGN KEY ("creditor_branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_payments" ADD CONSTRAINT "inter_branch_payments_payable_id_inter_branch_payables_id_fk" FOREIGN KEY ("payable_id") REFERENCES "petshop"."inter_branch_payables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."inter_branch_payments" ADD CONSTRAINT "inter_branch_payments_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_category_id_cash_flow_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "petshop"."cash_flow_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."cash_flow_entries" ADD CONSTRAINT "cash_flow_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_barcodes_product" ON "petshop"."product_barcodes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_stock_batches_product_branch" ON "petshop"."product_stock_batches" USING btree ("product_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_stocks_product_branch_uniq" ON "petshop"."product_stocks" USING btree ("product_id","branch_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_items_transaction" ON "petshop"."transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_payments_transaction" ON "petshop"."transaction_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_customer_created" ON "petshop"."transactions" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_branch_created" ON "petshop"."transactions" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_shift" ON "petshop"."transactions" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_cashier_idx" ON "petshop"."shift_cashier_breakdown" USING btree ("shift_id","cashier_id");--> statement-breakpoint
CREATE INDEX "idx_shift_expenses_shift" ON "petshop"."shift_expenses" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_shifts_branch_status" ON "petshop"."shifts" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "idx_customer_debts_customer" ON "petshop"."customer_debts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customer_debts_transaction" ON "petshop"."customer_debts" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_debt_payments_debt" ON "petshop"."debt_payments" USING btree ("debt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ibp_transfer_unique" ON "petshop"."inter_branch_payables" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "cash_flow_entries_branch_created_idx" ON "petshop"."cash_flow_entries" USING btree ("branch_id","created_at");