ALTER TYPE "hris"."deduction_objection_target" ADD VALUE 'DRIVER_FINE';--> statement-breakpoint
CREATE TABLE "hris"."driver_fine_kind_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind_id" integer NOT NULL,
	"effective_on" date NOT NULL,
	"amount" integer NOT NULL,
	"active" boolean NOT NULL,
	"reason" text NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	CONSTRAINT "driver_fine_kind_versions_amount" CHECK ("hris"."driver_fine_kind_versions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."driver_fine_kinds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"example" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_fine_kinds_name_not_blank" CHECK (btrim("hris"."driver_fine_kinds"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."driver_fines" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind_id" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"trip_id" integer,
	"description" text NOT NULL,
	"photo_file_id" uuid,
	"amount" integer NOT NULL,
	"status" text NOT NULL,
	"request_id" integer,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_account_id" integer,
	"approved_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_by_account_id" integer,
	"end_reason" text,
	CONSTRAINT "driver_fines_status" CHECK ("hris"."driver_fines"."status" in ('PENDING', 'ACTIVE', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'WAIVED')),
	CONSTRAINT "driver_fines_amount" CHECK ("hris"."driver_fines"."amount" > 0),
	CONSTRAINT "driver_fines_description" CHECK (length(btrim("hris"."driver_fines"."description")) >= 15),
	CONSTRAINT "driver_fines_not_self" CHECK ("hris"."driver_fines"."employee_id" <> "hris"."driver_fines"."recorded_by_employee_id"),
	CONSTRAINT "driver_fines_approved" CHECK ("hris"."driver_fines"."status" not in ('ACTIVE', 'WAIVED') or "hris"."driver_fines"."approved_at" is not null),
	CONSTRAINT "driver_fines_ended" CHECK (("hris"."driver_fines"."status" in ('CANCELLED', 'WAIVED')) = ("hris"."driver_fines"."end_reason" is not null and "hris"."driver_fines"."ended_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."driver_fine_kind_versions" ADD CONSTRAINT "driver_fine_kind_versions_kind_id_driver_fine_kinds_id_fk" FOREIGN KEY ("kind_id") REFERENCES "hris"."driver_fine_kinds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."driver_fines" ADD CONSTRAINT "driver_fines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."driver_fines" ADD CONSTRAINT "driver_fines_kind_id_driver_fine_kinds_id_fk" FOREIGN KEY ("kind_id") REFERENCES "hris"."driver_fine_kinds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."driver_fines" ADD CONSTRAINT "driver_fines_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."driver_fines" ADD CONSTRAINT "driver_fines_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."driver_fines" ADD CONSTRAINT "driver_fines_recorded_by_employee_id_employees_id_fk" FOREIGN KEY ("recorded_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_fine_kind_versions_live_unique" ON "hris"."driver_fine_kind_versions" USING btree ("kind_id","effective_on") WHERE "hris"."driver_fine_kind_versions"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_fine_kinds_name_unique" ON "hris"."driver_fine_kinds" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "driver_fines_employee_idx" ON "hris"."driver_fines" USING btree ("employee_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_fines_request_unique" ON "hris"."driver_fines" USING btree ("request_id") WHERE "hris"."driver_fines"."request_id" is not null;--> statement-breakpoint
-- Ditulis tangan (spec L7 §3.6): tidak ada yang dihapus (PRI-02).
CREATE TRIGGER driver_fine_kinds_no_delete BEFORE DELETE ON hris.driver_fine_kinds FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER driver_fine_kind_versions_no_delete BEFORE DELETE ON hris.driver_fine_kind_versions FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER driver_fines_no_delete BEFORE DELETE ON hris.driver_fines FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Nominal denda disalin saat dibuat dan tidak berubah (S1).
CREATE FUNCTION hris.driver_fines_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.employee_id, NEW.kind_id, NEW.occurred_on, NEW.amount, NEW.recorded_by_employee_id, NEW.created_at)
     IS DISTINCT FROM (OLD.employee_id, OLD.kind_id, OLD.occurred_on, OLD.amount, OLD.recorded_by_employee_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Isi denda tidak boleh diubah; batalkan lalu ajukan ulang.';
  END IF;
  IF OLD.status in ('REJECTED', 'WITHDRAWN', 'CANCELLED', 'WAIVED') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Denda yang sudah selesai tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER driver_fines_guard BEFORE UPDATE ON hris.driver_fines FOR EACH ROW EXECUTE FUNCTION hris.driver_fines_guard();
--> statement-breakpoint
-- Isi awal jenis denda (spec L7 §9 butir 7, v3 S1): satu jenis Rp10.000 per kejadian.
INSERT INTO hris.driver_fine_kinds (name, example, sort_order) VALUES
  ('Tidak taat administrasi', 'Tidak foto nota belanja, tidak isi trip, tidak lapor sampai garasi, atau aturan administrasi trip lain yang dilanggar.', 1)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO hris.driver_fine_kind_versions (kind_id, effective_on, amount, active, reason)
SELECT id, '2026-10-30', 10000, true, 'Isi awal buku aturan v3 (S1)' FROM hris.driver_fine_kinds WHERE name = 'Tidak taat administrasi';
--> statement-breakpoint
-- Isi awal (harus ada di registry.ts, H18): tanggal kejadian paling jauh ke belakang (S3).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.fine_backdate_days', '7'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (S3)');
--> statement-breakpoint
-- Hak awal L7c (spec L7 §5). Pemilik dan GM lewat full_access; sahkan, batalkan, dan jenis denda ownerOnly.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'fine.propose', 'ALL'),
  ('hr', 'fine.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
