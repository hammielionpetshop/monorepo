CREATE TYPE "hris"."pay_waiver_fine_kind" AS ENUM('IN', 'OUT', 'RETURN', 'DAY_OFF_MISSING');--> statement-breakpoint
CREATE TYPE "hris"."pay_waiver_kind" AS ENUM('LATE', 'FINE');--> statement-breakpoint
CREATE TABLE "hris"."pay_waivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "hris"."pay_waiver_kind" NOT NULL,
	"work_date" date NOT NULL,
	"fine_kind" "hris"."pay_waiver_fine_kind",
	"reason" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "pay_waivers_fine_kind" CHECK (("hris"."pay_waivers"."kind" = 'FINE') = ("hris"."pay_waivers"."fine_kind" is not null)),
	CONSTRAINT "pay_waivers_not_self" CHECK ("hris"."pay_waivers"."employee_id" <> "hris"."pay_waivers"."created_by_employee_id"),
	CONSTRAINT "pay_waivers_reason_not_blank" CHECK (btrim("hris"."pay_waivers"."reason") <> ''),
	CONSTRAINT "pay_waivers_cancel_complete" CHECK (("hris"."pay_waivers"."cancelled_at" is null) = ("hris"."pay_waivers"."cancel_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."pay_waivers" ADD CONSTRAINT "pay_waivers_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."pay_waivers" ADD CONSTRAINT "pay_waivers_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_waivers_one_active_late" ON "hris"."pay_waivers" USING btree ("employee_id","work_date") WHERE "hris"."pay_waivers"."kind" = 'LATE' and "hris"."pay_waivers"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_waivers_one_active_fine" ON "hris"."pay_waivers" USING btree ("employee_id","work_date","fine_kind") WHERE "hris"."pay_waivers"."kind" = 'FINE' and "hris"."pay_waivers"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "pay_waivers_person_date_idx" ON "hris"."pay_waivers" USING btree ("employee_id","work_date");--> statement-breakpoint
-- Ditulis tangan (spec L4b §2): peniadaan tidak dihapus (PRI-02); hanya tanda batal yang boleh diisi, sekali.
CREATE TRIGGER pay_waivers_no_delete BEFORE DELETE ON hris.pay_waivers FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER pay_waivers_no_truncate BEFORE TRUNCATE ON hris.pay_waivers FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE FUNCTION hris.guard_pay_waiver() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Peniadaan yang sudah dibatalkan tidak bisa diubah.';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['cancelled_at','cancelled_by_account_id','cancel_reason'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['cancelled_at','cancelled_by_account_id','cancel_reason']) THEN
    RAISE EXCEPTION 'Isi peniadaan tidak bisa diubah; batalkan lalu buat yang baru.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER pay_waivers_guard BEFORE UPDATE ON hris.pay_waivers FOR EACH ROW EXECUTE FUNCTION hris.guard_pay_waiver();
--> statement-breakpoint
-- Isi awal Potongan & Lembur (harus ada di registry.ts, H18) = set yang berlaku di HRIS lama (tabel payroll_rules,
-- berlaku sejak 26 September 2026, diubah owner 2 November 2026); denda = nilai tertanam HRIS lama + v3. Spec L4b §3.1.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.overtime_rate', '10000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.late_rate', '1000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.ladder_permit_sick', '{"start":1,"step":0,"max":2}'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.ladder_permit_sudden', '{"start":1,"step":0,"max":2}'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.ladder_alpha', '{"start":1,"step":0,"max":2}'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.sick_letter', '{"day1":0,"day2to3":0.5,"day4plus":1}'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.training_multiplier', '1'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (Potongan & Lembur)'),
  ('payroll.day_off_compensation', '1'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal buku aturan v3 (GAJ-15)'),
  ('payroll.fine_forgot_in', '15000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (denda Lupa Absen Masuk)'),
  ('payroll.fine_forgot_out', '5000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal dari HRIS lama (denda Lupa Absen Pulang)'),
  ('payroll.fine_forgot_return', '5000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-154)'),
  ('payroll.fine_forgot_surcharge', '5000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-64)'),
  ('payroll.fine_day_off_missing', '10000'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal buku aturan v3 (KEH-135)'),
  ('position.day_off_compensation', '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4b §9 butir 5): dapat kompensasi libur');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.day_off_compensation', 'POSITION', p.id, '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4b §9 butir 5): Pemilik dan GM tidak mendapat kompensasi libur'
FROM hris.positions p
WHERE lower(p.name) IN ('pemilik', 'gm');
