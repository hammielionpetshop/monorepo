-- Kasir bisa MENGAJUKAN void & koreksi, bukan hanya meminta PIN atasan di tempat.
--
-- Sebelum ini keduanya hanya punya satu jalur: seseorang yang berwenang harus hadir dan
-- mengetikkan PIN-nya di mesin kasir. Kalau atasannya sedang tidak di toko, kasir tidak punya
-- pilihan apa pun — notanya dibiarkan salah, atau PIN-nya dipinjam lewat telepon. Yang kedua
-- membuat jejak audit berbohong: yang tercatat menyetujui adalah orang yang tidak ada di sana.
--
-- `void_requests` sudah melayani jalur pengajuan untuk void. Dua kolom di bawah membuatnya
-- menampung koreksi juga, alih-alih membuat tabel kedua yang bentuknya nyaris sama dan harus
-- ditampilkan berdampingan di daftar yang sama.
--
-- Nama tabel sengaja TIDAK diganti jadi `approval_requests`: 20+ berkas memakainya, dan
-- menyapu semuanya demi kerapian nama bukan pertukaran yang sepadan di PR yang sudah sebesar
-- ini. Namanya menyempit, cakupannya melebar — dicatat di sini supaya tidak membingungkan.

ALTER TABLE "petshop"."void_requests"
  ADD COLUMN IF NOT EXISTS "kind" varchar(20) DEFAULT 'VOID' NOT NULL;

-- Muatan koreksi yang diajukan (item, pembayaran, customer, jatuh tempo). Bentuknya sama
-- dengan body `POST /api/pos/transactions/[id]/edit`. NULL untuk permintaan VOID.
ALTER TABLE "petshop"."void_requests"
  ADD COLUMN IF NOT EXISTS "payload" jsonb;

-- Baris lama semuanya void — itulah satu-satunya jenis yang pernah ada. DEFAULT 'VOID' sudah
-- mengisinya, jadi tidak ada backfill yang perlu ditulis.

-- Satu transaksi tidak boleh punya dua permintaan menggantung sekaligus, apa pun jenisnya:
-- menyetujui koreksi atas nota yang permintaan void-nya juga menunggu berarti dua orang
-- memutuskan hal yang bertabrakan tanpa saling tahu. Route sudah memeriksanya, tapi cek di
-- aplikasi kalah balapan; index ini yang benar-benar menjamin.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_void_requests_one_pending_per_trx"
  ON "petshop"."void_requests" ("transaction_id")
  WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "idx_void_requests_status_kind"
  ON "petshop"."void_requests" ("status","kind");
