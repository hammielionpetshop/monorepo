CREATE TABLE "petshop"."customer_cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_customer_cart_item" UNIQUE("customer_id","product_id","uom_id")
);
--> statement-breakpoint
ALTER TABLE "petshop"."customer_cart_items" ADD CONSTRAINT "customer_cart_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "petshop"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_cart_items" ADD CONSTRAINT "customer_cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petshop"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."customer_cart_items" ADD CONSTRAINT "customer_cart_items_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "petshop"."units_of_measure"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_cart_items_customer" ON "petshop"."customer_cart_items" USING btree ("customer_id");