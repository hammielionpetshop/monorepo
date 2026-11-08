-- F2-1b Tempat Uang di HRIS (spec docs/work/specs/2026-11-08-f2-1-tempat-uang-design.md §6).
-- Daftar uang pindah ke Back Office (`petshop.money_places`, migrasi petshop 0055, berjalan lebih dulu);
-- HRIS hanya membaca lewat view dan menyimpan id-nya di `money_place_id` (tanpa FK lintas schema).
CREATE VIEW hris.pos_money_places AS
  SELECT id, name, kind, branch_id, held_by, holder_note, is_active AS active, sort_order,
    CASE WHEN kind = 'BANK' THEN right(regexp_replace(coalesce(account_number, ''), '\D', '', 'g'), 4) END AS account_tail
  FROM petshop.money_places;
--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" DROP CONSTRAINT "payslip_payments_money";--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayment_uses" DROP CONSTRAINT "unloading_overpayment_uses_refund";--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" DROP CONSTRAINT "unloading_payments_money";--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" DROP CONSTRAINT "advance_handovers_legacy_source";--> statement-breakpoint
ALTER TABLE "hris"."pay_batches" ALTER COLUMN "source_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."pay_batches" ADD COLUMN "money_place_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD COLUMN "money_place_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayment_uses" ADD COLUMN "money_place_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" ADD COLUMN "money_place_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD COLUMN "money_place_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."advance_movements" ADD COLUMN "money_place_id" integer;--> statement-breakpoint
-- Pemetaan sekali (spec §6 no.5): tiap Sumber Uang lama dicocokkan ke Tempat Uang bernama sama (selain Laci);
-- bila belum ada, dibuatkan di cabang Gudang, dipegang Finance. Rekening dibuat dengan isian "perlu dilengkapi"
-- supaya owner melengkapinya di Back Office. DB tanpa cabang (DB baru kosong) tidak dibuatkan apa-apa.
INSERT INTO petshop.money_places (name, kind, branch_id, bank_name, account_number, held_by, sort_order)
SELECT s.name,
  CASE WHEN s.method = 'TRANSFER' THEN 'BANK' ELSE 'CASH' END,
  b.id,
  CASE WHEN s.method = 'TRANSFER' THEN 'Perlu dilengkapi' END,
  CASE WHEN s.method = 'TRANSFER' THEN '-' END,
  'FINANCE',
  s.sort_order
FROM hris.payment_sources s
CROSS JOIN (
  SELECT id FROM petshop.branches ORDER BY (lower(name) = 'gudang') DESC, id LIMIT 1
) b
WHERE NOT EXISTS (
  SELECT 1 FROM petshop.money_places m WHERE lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER'
);
--> statement-breakpoint
-- Nama Tempat Uang selain Laci unik (uq_money_places_name), jadi tiap sumber lama cocok tepat satu.
-- pay_batches hanya boleh ditambah (reject_change); pengisian kolom baru ini satu-satunya pengecualian.
ALTER TABLE "hris"."pay_batches" DISABLE TRIGGER pay_batches_append_only;--> statement-breakpoint
UPDATE hris.pay_batches t SET money_place_id = m.id FROM hris.payment_sources s JOIN petshop.money_places m ON lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER' WHERE t.source_id = s.id;--> statement-breakpoint
ALTER TABLE "hris"."pay_batches" ENABLE TRIGGER pay_batches_append_only;--> statement-breakpoint
UPDATE hris.payslip_payments t SET money_place_id = m.id FROM hris.payment_sources s JOIN petshop.money_places m ON lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER' WHERE t.source_id = s.id;--> statement-breakpoint
UPDATE hris.unloading_payments t SET money_place_id = m.id FROM hris.payment_sources s JOIN petshop.money_places m ON lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER' WHERE t.source_id = s.id;--> statement-breakpoint
UPDATE hris.unloading_overpayment_uses t SET money_place_id = m.id FROM hris.payment_sources s JOIN petshop.money_places m ON lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER' WHERE t.source_id = s.id;--> statement-breakpoint
UPDATE hris.advance_handovers t SET money_place_id = m.id FROM hris.payment_sources s JOIN petshop.money_places m ON lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER' WHERE t.source_id = s.id;--> statement-breakpoint
UPDATE hris.advance_movements t SET money_place_id = m.id FROM hris.payment_sources s JOIN petshop.money_places m ON lower(m.name) = lower(s.name) AND m.kind <> 'DRAWER' WHERE t.source_id = s.id;--> statement-breakpoint
ALTER TABLE "hris"."pay_batches" ALTER COLUMN "money_place_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD CONSTRAINT "payslip_payments_money" CHECK ("hris"."payslip_payments"."kind" <> 'MONEY' or ("hris"."payslip_payments"."amount" > 0 and "hris"."payslip_payments"."batch_id" is not null and "hris"."payslip_payments"."money_place_id" is not null and "hris"."payslip_payments"."method" in ('CASH', 'TRANSFER')));--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayment_uses" ADD CONSTRAINT "unloading_overpayment_uses_refund" CHECK ("hris"."unloading_overpayment_uses"."kind" <> 'REFUND' or ("hris"."unloading_overpayment_uses"."money_place_id" is not null and "hris"."unloading_overpayment_uses"."money_date" is not null));--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" ADD CONSTRAINT "unloading_payments_money" CHECK ("hris"."unloading_payments"."kind" <> 'MONEY' or ("hris"."unloading_payments"."amount" > 0 and "hris"."unloading_payments"."money_place_id" is not null and "hris"."unloading_payments"."method" in ('CASH', 'TRANSFER')));--> statement-breakpoint
ALTER TABLE "hris"."advance_handovers" ADD CONSTRAINT "advance_handovers_legacy_source" CHECK (("hris"."advance_handovers"."method" = 'LEGACY') = ("hris"."advance_handovers"."money_place_id" is null));--> statement-breakpoint
-- Penjaga ubah baris ikut mengunci kolom sumber uang yang baru.
CREATE OR REPLACE FUNCTION hris.unloading_payments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.report_id, NEW.top_up_id, NEW.kind, NEW.amount, NEW.money_date, NEW.source_id, NEW.money_place_id, NEW.method, NEW.paid_by_account_id, NEW.created_at)
     IS DISTINCT FROM (OLD.report_id, OLD.top_up_id, OLD.kind, OLD.amount, OLD.money_date, OLD.source_id, OLD.money_place_id, OLD.method, OLD.paid_by_account_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Pembayaran bongkaran tidak boleh diubah; batal bayar lalu bayar ulang.';
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Pembayaran bongkaran yang batal tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hris.unloading_overpayment_uses_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.overpayment_id, NEW.kind, NEW.amount, NEW.payment_id, NEW.source_id, NEW.money_place_id, NEW.money_date)
     IS DISTINCT FROM (OLD.overpayment_id, OLD.kind, OLD.amount, OLD.payment_id, OLD.source_id, OLD.money_place_id, OLD.money_date)
     OR (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED') THEN
    RAISE EXCEPTION 'Pemakaian lebih bayar hanya boleh dibatalkan.';
  END IF;
  RETURN NEW;
END $$;
