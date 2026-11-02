CREATE TYPE "hris"."salary_change_origin" AS ENUM('DIRECT', 'PROPOSAL', 'STANDARD_PROMOTION');--> statement-breakpoint
CREATE TYPE "hris"."salary_standard_kind" AS ENUM('TRAINING', 'EMPLOYEE');--> statement-breakpoint
CREATE TABLE "hris"."salary_change_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"change_id" integer NOT NULL,
	"component_type_id" integer NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "salary_change_lines_positive" CHECK ("hris"."salary_change_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."salary_change_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"lines" jsonb NOT NULL,
	"before_lines" jsonb,
	"reason" text NOT NULL,
	"deadline_on" date NOT NULL,
	"proposed_by_account_id" integer NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"salary_change_id" integer,
	CONSTRAINT "salary_change_proposals_period_start" CHECK (extract(day from "hris"."salary_change_proposals"."effective_from") = 26),
	CONSTRAINT "salary_change_proposals_state" CHECK ("hris"."salary_change_proposals"."state" in ('OPEN', 'APPROVED', 'CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "hris"."salary_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"origin" "hris"."salary_change_origin" NOT NULL,
	"reason" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"proposed_by_account_id" integer,
	"request_id" integer,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "salary_changes_period_start" CHECK (extract(day from "hris"."salary_changes"."effective_from") = 26),
	CONSTRAINT "salary_changes_reason_not_blank" CHECK (btrim("hris"."salary_changes"."reason") <> ''),
	CONSTRAINT "salary_changes_cancel_complete" CHECK (("hris"."salary_changes"."cancelled_at" is null) = ("hris"."salary_changes"."cancel_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."salary_component_type_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_type_id" integer NOT NULL,
	"old_name" text NOT NULL,
	"new_name" text NOT NULL,
	"changed_by_account_id" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."salary_component_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_component_types_name_not_blank" CHECK (btrim("hris"."salary_component_types"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."salary_standard_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"standard_id" integer NOT NULL,
	"component_type_id" integer NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "salary_standard_lines_positive" CHECK ("hris"."salary_standard_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."salary_standards" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "hris"."salary_standard_kind" NOT NULL,
	"effective_from" date NOT NULL,
	"reason" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "salary_standards_period_start" CHECK (extract(day from "hris"."salary_standards"."effective_from") = 26),
	CONSTRAINT "salary_standards_reason_not_blank" CHECK (btrim("hris"."salary_standards"."reason") <> ''),
	CONSTRAINT "salary_standards_cancel_complete" CHECK (("hris"."salary_standards"."cancelled_at" is null) = ("hris"."salary_standards"."cancel_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."salary_change_lines" ADD CONSTRAINT "salary_change_lines_change_id_salary_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "hris"."salary_changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_change_lines" ADD CONSTRAINT "salary_change_lines_component_type_id_salary_component_types_id_fk" FOREIGN KEY ("component_type_id") REFERENCES "hris"."salary_component_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_change_proposals" ADD CONSTRAINT "salary_change_proposals_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_change_proposals" ADD CONSTRAINT "salary_change_proposals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_change_proposals" ADD CONSTRAINT "salary_change_proposals_salary_change_id_salary_changes_id_fk" FOREIGN KEY ("salary_change_id") REFERENCES "hris"."salary_changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_changes" ADD CONSTRAINT "salary_changes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_changes" ADD CONSTRAINT "salary_changes_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_component_type_names" ADD CONSTRAINT "salary_component_type_names_component_type_id_salary_component_types_id_fk" FOREIGN KEY ("component_type_id") REFERENCES "hris"."salary_component_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_standard_lines" ADD CONSTRAINT "salary_standard_lines_standard_id_salary_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "hris"."salary_standards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."salary_standard_lines" ADD CONSTRAINT "salary_standard_lines_component_type_id_salary_component_types_id_fk" FOREIGN KEY ("component_type_id") REFERENCES "hris"."salary_component_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_change_lines_unique" ON "hris"."salary_change_lines" USING btree ("change_id","component_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_change_proposals_request_unique" ON "hris"."salary_change_proposals" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "salary_change_proposals_person_idx" ON "hris"."salary_change_proposals" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "salary_changes_person_idx" ON "hris"."salary_changes" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_changes_one_per_date" ON "hris"."salary_changes" USING btree ("employee_id","effective_from") WHERE "hris"."salary_changes"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX "salary_component_type_names_type_idx" ON "hris"."salary_component_type_names" USING btree ("component_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_component_types_name_unique" ON "hris"."salary_component_types" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "salary_standard_lines_unique" ON "hris"."salary_standard_lines" USING btree ("standard_id","component_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_standards_one_per_date" ON "hris"."salary_standards" USING btree ("kind","effective_from") WHERE "hris"."salary_standards"."cancelled_at" is null;--> statement-breakpoint
-- Ditulis tangan (spec L4a §2): tidak ada yang dihapus (PRI-02). Pembatalan = tanda, isi paket tidak diubah.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['salary_component_types','salary_component_type_names','salary_changes','salary_change_lines','salary_standards','salary_standard_lines','salary_change_proposals'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()', t || '_no_truncate', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER salary_change_lines_no_update BEFORE UPDATE ON hris.salary_change_lines FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER salary_standard_lines_no_update BEFORE UPDATE ON hris.salary_standard_lines FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER salary_component_type_names_no_update BEFORE UPDATE ON hris.salary_component_type_names FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Paket gaji dan Gaji Standar: hanya tanda batal yang boleh diisi, sekali.
CREATE FUNCTION hris.guard_salary_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Paket gaji yang sudah dibatalkan tidak bisa diubah.';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['cancelled_at','cancelled_by_account_id','cancel_reason'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['cancelled_at','cancelled_by_account_id','cancel_reason']) THEN
    RAISE EXCEPTION 'Isi paket gaji tidak bisa diubah; buat paket baru.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER salary_changes_guard BEFORE UPDATE ON hris.salary_changes FOR EACH ROW EXECUTE FUNCTION hris.guard_salary_package();
--> statement-breakpoint
CREATE TRIGGER salary_standards_guard BEFORE UPDATE ON hris.salary_standards FOR EACH ROW EXECUTE FUNCTION hris.guard_salary_package();
--> statement-breakpoint
-- Isi awal jenis komponen (GAJ-65; Tunjangan Khusus tidak dibawa).
INSERT INTO hris.salary_component_types (name, sort_order) VALUES
  ('Gaji Pokok', 1), ('Tunjangan Jabatan', 2), ('Tunjangan Tetap', 3);
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18). Spec L4a §3.6 dan §9 butir 2, 3.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.daily_divisor', '26'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (GAJ-05)'),
  ('position.pay_basis', '"MONTHLY"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (GAJ-02): bergaji bulanan'),
  ('position.salary_owner_only', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (KAR-83)');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.pay_basis', 'POSITION', p.id, '"WEEKLY"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4a §9 butir 2): Driver dan Kenek dibayar per ritase'
FROM hris.positions p
WHERE lower(p.name) IN ('driver', 'kenek');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.salary_owner_only', 'POSITION', p.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4a §9 butir 3): gaji Pemilik dan GM'
FROM hris.positions p
WHERE lower(p.name) IN ('pemilik', 'gm');
--> statement-breakpoint
-- Hak awal (spec L4a §5). Pemilik dan GM punya semuanya lewat full_access.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'salary.view', 'ALL'), ('hr', 'salary.propose', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
