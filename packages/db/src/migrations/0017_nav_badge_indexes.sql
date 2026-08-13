-- Indeks untuk query badge navigasi.
--
-- `GET /api/bo/nav-badges` menghitung tujuh angka "menunggu diproses" dan dipanggil setiap
-- sidebar dimuat serta tiap 60 detik per tab yang terbuka — pemanggil DB paling sering di
-- seluruh aplikasi. Dari tujuh subquery itu, ENAM tidak punya indeks yang bisa dipakai sama
-- sekali dan berakhir sebagai sequential scan; hanya `customer_orders` yang sudah terlayani
-- (`idx_customer_orders_status_created`).
--
-- Ini BUKAN penyebab 504 yang sedang dikejar — hang itu lahir di antrean pool postgres.js,
-- bukan di lambatnya query, dan tabel-tabel ini masih kecil sehingga seq scan-nya pun cepat.
-- Indeks di sini mencegah pembusukan pelan: biayanya tumbuh linier selamanya tanpa ada yang
-- memperhatikan, dan `customer_debts` bertambah tiap transaksi kredit.
--
-- Urutan kolom `(status, branch_id)`, bukan sebaliknya: OWNER/GM punya `branchScope = 'ALL'`
-- sehingga query-nya menyaring status SAJA, dan prefix indeks tetap melayani mereka. Kalau
-- `branch_id` ditaruh di depan, kasus itu kembali jadi seq scan.
--
-- `inter_branch_transfers` dan `inter_branch_payables` dapat DUA indeks masing-masing karena
-- cabang user bisa muncul di kolom asal ATAU tujuan (debitur ATAU kreditur). Kondisi `OR`
-- tidak bisa dilayani satu indeks gabungan; dua indeks terpisah digabung Postgres lewat
-- BitmapOr.
--
-- Tanpa CONCURRENTLY: drizzle-kit menjalankan migrasi di dalam transaksi dan CONCURRENTLY
-- dilarang di sana — alasan yang sama seperti migrasi 0016. Konsekuensinya CREATE INDEX
-- memegang kunci yang MEMBLOKIR TULIS (baca tetap jalan) pada tabel bersangkutan selama
-- pembuatan. Untuk tabel operasional sebesar ini pembuatannya seketika, tapi `customer_debts`
-- adalah yang terbesar dan ikut ditulis kasir saat transaksi kredit — jalankan di luar jam
-- ramai.

CREATE INDEX IF NOT EXISTS "idx_purchase_orders_status_branch"
  ON "petshop"."purchase_orders" ("status", "branch_id");

CREATE INDEX IF NOT EXISTS "idx_stock_opnames_status_branch"
  ON "petshop"."stock_opnames" ("status", "branch_id");

CREATE INDEX IF NOT EXISTS "idx_customer_debts_status_branch"
  ON "petshop"."customer_debts" ("status", "branch_id");

CREATE INDEX IF NOT EXISTS "idx_void_requests_status"
  ON "petshop"."void_requests" ("status");

CREATE INDEX IF NOT EXISTS "idx_ibt_status_source"
  ON "petshop"."inter_branch_transfers" ("status", "source_branch_id");

CREATE INDEX IF NOT EXISTS "idx_ibt_status_destination"
  ON "petshop"."inter_branch_transfers" ("status", "destination_branch_id");

CREATE INDEX IF NOT EXISTS "idx_ibp_status_debtor"
  ON "petshop"."inter_branch_payables" ("status", "debtor_branch_id");

CREATE INDEX IF NOT EXISTS "idx_ibp_status_creditor"
  ON "petshop"."inter_branch_payables" ("status", "creditor_branch_id");
