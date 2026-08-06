-- Koreksi transaksi (edit in-place) — nomor nota tetap, stok & uang ikut disesuaikan.
--
-- Kunci desainnya ada di `original_qty` / `original_cogs` pada transaction_items.
-- Buku besar stok menurunkan baris SALE_OUT langsung dari transaction_items yang hidup,
-- jadi kalau qty diedit di tempat tanpa snapshot ini, mutasi stok di jam jual ikut
-- berubah surut dan baris koreksi EDIT_IN/EDIT_OUT jadi dobel-hitung.
--   SALE_OUT  = -COALESCE(original_qty, qty)   pada jam jual
--   EDIT_*    = original_qty - qty             pada jam koreksi
-- Keduanya dijumlahkan selalu sama dengan stok yang benar-benar berpindah.

ALTER TABLE "petshop"."transactions" ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

ALTER TABLE "petshop"."transaction_items" ADD COLUMN IF NOT EXISTS "original_qty" integer;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_items" ADD COLUMN IF NOT EXISTS "original_cogs" integer;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_items" ADD COLUMN IF NOT EXISTS "is_removed" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Riwayat koreksi: satu baris per revisi, snapshot utuh sebelum & sesudah.
CREATE TABLE IF NOT EXISTS "petshop"."transaction_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"revision" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"shift_id" integer NOT NULL,
	"edited_by_id" integer NOT NULL,
	"approved_by_id" integer,
	"reason" text NOT NULL,
	"before_data" jsonb NOT NULL,
	"after_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petshop"."transaction_edits" ADD CONSTRAINT "transaction_edits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "petshop"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_edits" ADD CONSTRAINT "transaction_edits_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petshop"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_edits" ADD CONSTRAINT "transaction_edits_edited_by_id_users_id_fk" FOREIGN KEY ("edited_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."transaction_edits" ADD CONSTRAINT "transaction_edits_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transaction_edits_transaction" ON "petshop"."transaction_edits" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_transaction_edits_trx_revision" ON "petshop"."transaction_edits" USING btree ("transaction_id","revision");--> statement-breakpoint

-- Izin per orang, di luar izin bawaan role.
CREATE TABLE IF NOT EXISTS "petshop"."user_permissions" (
	"user_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"granted_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_id_pk" PRIMARY KEY("user_id","permission_id")
);
--> statement-breakpoint
ALTER TABLE "petshop"."user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "petshop"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "petshop"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petshop"."user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "petshop"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Izin koreksi transaksi. Sengaja TIDAK diberikan ke role mana pun secara default —
-- penunjukannya per orang lewat Settings → User (tabel user_permissions di atas).
INSERT INTO "petshop"."permissions" ("code", "name", "description")
VALUES (
	'transaction.edit',
	'Koreksi Transaksi',
	'Menyetujui koreksi item transaksi yang sudah tersimpan (qty, produk, harga) selama shift masih terbuka. Stok & pembayaran ikut disesuaikan.'
)
ON CONFLICT ("code") DO NOTHING;
