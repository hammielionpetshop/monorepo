ALTER TABLE "hris"."employees" ADD COLUMN "emergency_contact_relation" text;--> statement-breakpoint
ALTER TABLE "hris"."employees" ADD COLUMN "national_id" text;--> statement-breakpoint
ALTER TABLE "hris"."employees" ADD COLUMN "legacy_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_national_id_unique" ON "hris"."employees" USING btree ("national_id") WHERE "hris"."employees"."national_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_legacy_code_unique" ON "hris"."employees" USING btree ("legacy_code") WHERE "hris"."employees"."legacy_code" is not null;--> statement-breakpoint
ALTER TABLE "hris"."employees" ADD CONSTRAINT "employees_national_id_format" CHECK ("hris"."employees"."national_id" ~ '^[0-9]{16}$');--> statement-breakpoint
ALTER TABLE "hris"."employees" ADD CONSTRAINT "employees_legacy_code_format" CHECK ("hris"."employees"."legacy_code" ~ '^[A-Z]+-[0-9]+$');--> statement-breakpoint
-- Kode lama hanya boleh diisi sekali (kosong → isi); sesudahnya tidak bisa diubah atau dikosongkan (L9c).
CREATE OR REPLACE FUNCTION "hris"."guard_employee_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.code <> OLD.code OR NEW.source <> OLD.source THEN
    RAISE EXCEPTION 'Kode dan asal data karyawan tidak bisa diubah.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.legacy_code IS NOT NULL AND NEW.legacy_code IS DISTINCT FROM OLD.legacy_code THEN
    RAISE EXCEPTION 'Kode lama karyawan tidak bisa diubah.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
