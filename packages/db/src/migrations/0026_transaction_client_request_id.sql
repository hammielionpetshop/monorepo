-- Kunci idempotensi checkout POS. Saat koneksi lambat, request pertama bisa sudah tersimpan
-- tapi responsnya tidak sampai ke browser; kasir lalu menekan Bayar lagi dan transaksi
-- tercatat dobel. Klien mengirim UUID yang sama untuk percobaan ulang, server mengembalikan
-- transaksi yang sudah ada alih-alih membuat baru. NULL untuk transaksi lama & jalur lain.

ALTER TABLE "petshop"."transactions" ADD COLUMN IF NOT EXISTS "client_request_id" varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_transactions_client_request_id"
  ON "petshop"."transactions" ("client_request_id");
