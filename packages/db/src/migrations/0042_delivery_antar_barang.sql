-- Pengantaran barang dari tab Kasir (spec jasa grooming butir 28–31): setiap nota berisi ongkir
-- mencatat pengantar. Antar barang tidak mencatat alamat dan boleh tanpa pelanggan, jadi dua kolom
-- ini dilonggarkan. Hanya melonggarkan — tidak ada data yang diubah atau dihapus.
ALTER TABLE "petshop"."service_deliveries" ALTER COLUMN "address" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "petshop"."service_deliveries" ALTER COLUMN "customer_id" DROP NOT NULL;
