CREATE TABLE "petshop"."stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"adjusted_by_id" integer NOT NULL,
	"previous_qty" numeric(12, 2) NOT NULL,
	"new_qty" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petshop"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."stock_adjustments" ADD CONSTRAINT "stock_adjustments_adjusted_by_id_users_id_fk" FOREIGN KEY ("adjusted_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;