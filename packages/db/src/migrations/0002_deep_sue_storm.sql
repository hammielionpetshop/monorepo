ALTER TABLE "petshop"."transactions" ADD COLUMN "sale_type" varchar(10) DEFAULT 'RETAIL' NOT NULL;--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD COLUMN "source_ibt_id" integer;--> statement-breakpoint
ALTER TABLE "petshop"."transactions" ADD CONSTRAINT "transactions_source_ibt_id_inter_branch_transfers_id_fk" FOREIGN KEY ("source_ibt_id") REFERENCES "petshop"."inter_branch_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transactions_sale_type" ON "petshop"."transactions" USING btree ("sale_type");