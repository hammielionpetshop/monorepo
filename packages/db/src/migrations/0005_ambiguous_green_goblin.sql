ALTER TABLE "petshop"."return_items" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ALTER COLUMN "return_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ALTER COLUMN "qty" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ALTER COLUMN "cogs" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "petshop"."return_items" ALTER COLUMN "refund_amount" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "petshop"."returns" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "petshop"."returns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "petshop"."returns" ALTER COLUMN "total_refund_amount" SET DATA TYPE numeric(15, 4);