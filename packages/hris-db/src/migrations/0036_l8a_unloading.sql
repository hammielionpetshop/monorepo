CREATE TABLE "hris"."casual_workers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casual_workers_name_not_blank" CHECK (btrim("hris"."casual_workers"."name") <> ''),
	CONSTRAINT "casual_workers_phone_digits" CHECK ("hris"."casual_workers"."phone" ~ '^[0-9]{8,15}$')
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"version" integer NOT NULL,
	"product_id" integer,
	"uom_id" integer,
	"product_name" text NOT NULL,
	"uom_name" text,
	"quantity" numeric(12, 3),
	"weight_kg" numeric(12, 3),
	"line_kg" numeric(14, 3) NOT NULL,
	"other_reason" text,
	"weight_flagged" boolean DEFAULT false NOT NULL,
	"linked_product_id" integer,
	"linked_product_name" text,
	"linked_by_account_id" integer,
	"linked_at" timestamp with time zone,
	CONSTRAINT "unloading_items_shape" CHECK (("hris"."unloading_items"."product_id" is not null and "hris"."unloading_items"."uom_id" is not null and "hris"."unloading_items"."quantity" > 0 and "hris"."unloading_items"."weight_kg" > 0 and "hris"."unloading_items"."other_reason" is null) or ("hris"."unloading_items"."product_id" is null and "hris"."unloading_items"."uom_id" is null and "hris"."unloading_items"."quantity" is null and "hris"."unloading_items"."weight_kg" is null and length(btrim(coalesce("hris"."unloading_items"."other_reason", ''))) >= 15)),
	CONSTRAINT "unloading_items_kg" CHECK ("hris"."unloading_items"."line_kg" > 0),
	CONSTRAINT "unloading_items_link" CHECK ("hris"."unloading_items"."linked_product_id" is null or "hris"."unloading_items"."product_id" is null)
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"version" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "unloading_photos_kind" CHECK ("hris"."unloading_photos"."kind" in ('DELIVERY_NOTE', 'GOODS'))
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_report_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"version" integer NOT NULL,
	"work_date" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"supplier_name" text NOT NULL,
	"rate" integer NOT NULL,
	"total_kg" numeric(14, 3) NOT NULL,
	"total_pay" integer NOT NULL,
	"reason" text,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unloading_report_versions_reason" CHECK ("hris"."unloading_report_versions"."version" = 1 or length(btrim(coalesce("hris"."unloading_report_versions"."reason", ''))) >= 15)
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"work_date" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"supplier_name" text NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"rate" integer NOT NULL,
	"total_kg" numeric(14, 3) NOT NULL,
	"total_pay" integer NOT NULL,
	"cost_branch_id" integer,
	"late_reason" text,
	"request_id" integer,
	"similar_to_id" integer,
	"no_delivery_note_reason" text,
	"created_by_account_id" integer NOT NULL,
	"created_by_employee_id" integer NOT NULL,
	"created_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by_account_id" integer,
	CONSTRAINT "unloading_reports_status" CHECK ("hris"."unloading_reports"."status" in ('PENDING', 'ACTIVE', 'REJECTED', 'WITHDRAWN', 'PAID', 'CANCELLED')),
	CONSTRAINT "unloading_reports_numbers" CHECK ("hris"."unloading_reports"."rate" >= 0 and "hris"."unloading_reports"."total_kg" > 0 and "hris"."unloading_reports"."total_pay" >= 0 and "hris"."unloading_reports"."version" >= 1),
	CONSTRAINT "unloading_reports_active_branch" CHECK ("hris"."unloading_reports"."status" not in ('ACTIVE', 'PAID') or ("hris"."unloading_reports"."cost_branch_id" is not null and "hris"."unloading_reports"."activated_at" is not null)),
	CONSTRAINT "unloading_reports_late" CHECK ("hris"."unloading_reports"."late_reason" is null or length(btrim("hris"."unloading_reports"."late_reason")) >= 15),
	CONSTRAINT "unloading_reports_no_note" CHECK ("hris"."unloading_reports"."no_delivery_note_reason" is null or length(btrim("hris"."unloading_reports"."no_delivery_note_reason")) >= 15)
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"version" integer NOT NULL,
	"employee_id" integer,
	"casual_worker_id" integer,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"plus_one" boolean DEFAULT false NOT NULL,
	"day_status" text,
	"needs_look" boolean DEFAULT false NOT NULL,
	"looked_at" timestamp with time zone,
	"looked_by_account_id" integer,
	"look_note" text,
	"status" text NOT NULL,
	CONSTRAINT "unloading_shares_person" CHECK (("hris"."unloading_shares"."employee_id" is null) <> ("hris"."unloading_shares"."casual_worker_id" is null)),
	CONSTRAINT "unloading_shares_status" CHECK ("hris"."unloading_shares"."status" in ('PENDING', 'ACTIVE', 'CANCELLED')),
	CONSTRAINT "unloading_shares_amount" CHECK ("hris"."unloading_shares"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_unit_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"weight_kg" numeric(12, 3) NOT NULL,
	"updated_by_account_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unloading_unit_weights_positive" CHECK ("hris"."unloading_unit_weights"."weight_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_weight_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"uom_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"uom_name" text NOT NULL,
	"from_kg" numeric(12, 3),
	"to_kg" numeric(12, 3) NOT NULL,
	"change_percent" numeric(10, 2),
	"reason" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"report_id" integer,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_account_id" integer,
	"review_note" text,
	CONSTRAINT "unloading_weight_changes_reason" CHECK ("hris"."unloading_weight_changes"."from_kg" is null or length(btrim(coalesce("hris"."unloading_weight_changes"."reason", ''))) >= 15)
);
--> statement-breakpoint
ALTER TABLE "hris"."unloading_items" ADD CONSTRAINT "unloading_items_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_photos" ADD CONSTRAINT "unloading_photos_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_photos" ADD CONSTRAINT "unloading_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_report_versions" ADD CONSTRAINT "unloading_report_versions_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_cost_branch_id_branches_id_fk" FOREIGN KEY ("cost_branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_similar_to_id_unloading_reports_id_fk" FOREIGN KEY ("similar_to_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD CONSTRAINT "unloading_reports_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_shares" ADD CONSTRAINT "unloading_shares_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_shares" ADD CONSTRAINT "unloading_shares_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_shares" ADD CONSTRAINT "unloading_shares_casual_worker_id_casual_workers_id_fk" FOREIGN KEY ("casual_worker_id") REFERENCES "hris"."casual_workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_weight_changes" ADD CONSTRAINT "unloading_weight_changes_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "casual_workers_phone_unique" ON "hris"."casual_workers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "unloading_items_report_idx" ON "hris"."unloading_items" USING btree ("report_id","version");--> statement-breakpoint
CREATE INDEX "unloading_photos_report_idx" ON "hris"."unloading_photos" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_report_versions_unique" ON "hris"."unloading_report_versions" USING btree ("report_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_reports_number_unique" ON "hris"."unloading_reports" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_reports_request_unique" ON "hris"."unloading_reports" USING btree ("request_id") WHERE "hris"."unloading_reports"."request_id" is not null;--> statement-breakpoint
CREATE INDEX "unloading_reports_work_date_idx" ON "hris"."unloading_reports" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "unloading_reports_status_idx" ON "hris"."unloading_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "unloading_shares_report_idx" ON "hris"."unloading_shares" USING btree ("report_id","version");--> statement-breakpoint
CREATE INDEX "unloading_shares_employee_idx" ON "hris"."unloading_shares" USING btree ("employee_id") WHERE "hris"."unloading_shares"."employee_id" is not null;--> statement-breakpoint
CREATE INDEX "unloading_shares_casual_idx" ON "hris"."unloading_shares" USING btree ("casual_worker_id") WHERE "hris"."unloading_shares"."casual_worker_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_shares_one_employee" ON "hris"."unloading_shares" USING btree ("report_id","version","employee_id") WHERE "hris"."unloading_shares"."employee_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_shares_one_casual" ON "hris"."unloading_shares" USING btree ("report_id","version","casual_worker_id") WHERE "hris"."unloading_shares"."casual_worker_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_unit_weights_unique" ON "hris"."unloading_unit_weights" USING btree ("product_id","uom_id");--> statement-breakpoint
CREATE INDEX "unloading_weight_changes_product_idx" ON "hris"."unloading_weight_changes" USING btree ("product_id","uom_id");--> statement-breakpoint
CREATE INDEX "unloading_weight_changes_flagged_idx" ON "hris"."unloading_weight_changes" USING btree ("created_at") WHERE "hris"."unloading_weight_changes"."flagged" and "hris"."unloading_weight_changes"."reviewed_at" is null;
--> statement-breakpoint
-- Ditulis tangan (spec L8 §2): tidak ada yang dihapus (PRI-02, DRV-49, 83).
CREATE TRIGGER casual_workers_no_delete BEFORE DELETE ON hris.casual_workers FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_unit_weights_no_delete BEFORE DELETE ON hris.unloading_unit_weights FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_weight_changes_no_delete BEFORE DELETE ON hris.unloading_weight_changes FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_reports_no_delete BEFORE DELETE ON hris.unloading_reports FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_report_versions_no_change BEFORE UPDATE OR DELETE ON hris.unloading_report_versions FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_items_no_delete BEFORE DELETE ON hris.unloading_items FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_shares_no_delete BEFORE DELETE ON hris.unloading_shares FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_photos_no_change BEFORE UPDATE OR DELETE ON hris.unloading_photos FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Barang: hanya pasangan produk (Barang lain → produk, DRV-34) yang boleh berubah; kg dan berat tidak (DRV-109).
CREATE FUNCTION hris.unloading_items_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.report_id, NEW.version, NEW.product_id, NEW.uom_id, NEW.product_name, NEW.uom_name, NEW.quantity, NEW.weight_kg, NEW.line_kg, NEW.other_reason, NEW.weight_flagged)
     IS DISTINCT FROM (OLD.report_id, OLD.version, OLD.product_id, OLD.uom_id, OLD.product_name, OLD.uom_name, OLD.quantity, OLD.weight_kg, OLD.line_kg, OLD.other_reason, OLD.weight_flagged) THEN
    RAISE EXCEPTION 'Isi barang laporan bongkaran tidak boleh diubah; koreksi laporannya.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER unloading_items_guard BEFORE UPDATE ON hris.unloading_items FOR EACH ROW EXECUTE FUNCTION hris.unloading_items_guard();
--> statement-breakpoint
-- Buku Upah bongkaran: nominal dan orang terkunci sesudah Berlaku; baris batal tidak hidup lagi (DRV-108).
CREATE FUNCTION hris.unloading_shares_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING' AND (NEW.report_id, NEW.version, NEW.employee_id, NEW.casual_worker_id, NEW.amount, NEW.plus_one, NEW.day_status, NEW.needs_look)
     IS DISTINCT FROM (OLD.report_id, OLD.version, OLD.employee_id, OLD.casual_worker_id, OLD.amount, OLD.plus_one, OLD.day_status, OLD.needs_look) THEN
    RAISE EXCEPTION 'Bagian upah bongkaran tidak boleh diubah; koreksi laporannya.';
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Bagian upah bongkaran yang batal tidak bisa dihidupkan lagi.';
  END IF;
  IF OLD.status = 'ACTIVE' AND NEW.status = 'PENDING' THEN
    RAISE EXCEPTION 'Bagian upah bongkaran yang berlaku tidak bisa kembali menunggu.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER unloading_shares_guard BEFORE UPDATE ON hris.unloading_shares FOR EACH ROW EXECUTE FUNCTION hris.unloading_shares_guard();
--> statement-breakpoint
-- Laporan: nomor dan pembuat terkunci; laporan selesai (ditolak, ditarik, dibatalkan) tidak dihidupkan lagi.
CREATE FUNCTION hris.unloading_reports_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.number, NEW.created_by_account_id, NEW.created_by_employee_id, NEW.created_on, NEW.created_at)
     IS DISTINCT FROM (OLD.number, OLD.created_by_account_id, OLD.created_by_employee_id, OLD.created_on, OLD.created_at) THEN
    RAISE EXCEPTION 'Nomor dan pembuat laporan bongkaran tidak boleh diubah.';
  END IF;
  IF OLD.status in ('REJECTED', 'WITHDRAWN', 'CANCELLED') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Laporan bongkaran yang sudah selesai tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER unloading_reports_guard BEFORE UPDATE ON hris.unloading_reports FOR EACH ROW EXECUTE FUNCTION hris.unloading_reports_guard();
--> statement-breakpoint
-- View kasir untuk bongkaran (PRD 09 §3, spec L8 §2): produk BARANG, satuan dasar + konversi (gram per satuan dari kasir
-- sebagai saran isian, §9 butir 3), supplier. Kolomnya kontrak; stub tes di packages/hris-db/test-stubs/petshop-pos.sql.
CREATE VIEW hris.pos_products AS
  SELECT p.id, p.sku, p.name, p.is_active AS active FROM petshop.products p WHERE p.product_kind = 'BARANG';
--> statement-breakpoint
CREATE VIEW hris.pos_product_units AS
  SELECT p.id AS product_id, u.id AS uom_id, u.code AS uom_code, u.name AS uom_name, p.weight_gram, true AS is_base
  FROM petshop.products p JOIN petshop.units_of_measure u ON u.id = p.base_uom_id WHERE p.product_kind = 'BARANG'
  UNION ALL
  SELECT c.product_id, u.id, u.code, u.name, c.weight_gram, false
  FROM petshop.product_uom_conversions c JOIN petshop.units_of_measure u ON u.id = c.uom_id JOIN petshop.products p ON p.id = c.product_id
  WHERE p.product_kind = 'BARANG' AND c.uom_id <> p.base_uom_id;
--> statement-breakpoint
CREATE VIEW hris.pos_suppliers AS
  SELECT id, name, is_active AS active FROM petshop.suppliers;
--> statement-breakpoint
-- Isi awal pengaturan (harus ada di registry.ts, H18; spec L8 §3.6). Tarif Rp20/kg berlaku 26 Okt 2026 (§9 butir 6).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.unloading_rate_per_kg', '20'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-42)'),
  ('payroll.unloading_backdate_days', '3'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-36)'),
  ('payroll.unloading_weight_flag_percent', '10'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (L5)'),
  ('payroll.unloading_overpay_flag_days', '30'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-49)');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, value, effective_from, status, reason)
SELECT 'payroll.unloading_cost_branch', to_jsonb(id::text), '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (DRV-51)'
FROM hris.branches WHERE lower(name) = 'gudang' ORDER BY id LIMIT 1;
--> statement-breakpoint
-- Hak awal L8a (spec L8 §5). Pekerja Lepas memakai hak lama `freelancer.manage` (HR, Kepala Gudang, migrasi 0001). Pemilik dan GM lewat full_access; putuskan laporan terlambat, tinjau berat, pasangkan barang ownerOnly.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('kepala gudang', 'unloading.view', 'ALL'),
  ('kepala gudang', 'unloading.create', 'ALL'),
  ('finance', 'unloading.view', 'ALL'),
  ('finance', 'unloading.pay', 'ALL'),
  ('hr', 'unloading.review_day', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
