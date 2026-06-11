ALTER TABLE "petshop"."product_prices" ADD CONSTRAINT "product_prices_unique_tier" UNIQUE("product_id","branch_id","uom_id","tier_type");
