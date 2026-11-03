CREATE TABLE "hris"."bonus_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"employee_id" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"period_start" date NOT NULL,
	"kasir_branch_id" integer,
	"branch_name" text NOT NULL,
	"base_amount" integer NOT NULL,
	"percent" integer,
	"amount" integer NOT NULL,
	"fund" text DEFAULT 'OFFICE' NOT NULL,
	"status" text NOT NULL,
	"flag" text,
	"origin_key" text NOT NULL,
	"pos_ref_id" integer,
	"pos_groomer_id" integer,
	"trx_number" text,
	"service_name" text,
	"replaces_id" integer,
	"note" text,
	"reason" text,
	"decided_by_account_id" integer,
	"decided_by_employee_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonus_entries_status" CHECK ("hris"."bonus_entries"."status" in ('HELD', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
	CONSTRAINT "bonus_entries_kind" CHECK ("hris"."bonus_entries"."kind" in ('GROOMING', 'DELIVERY')),
	CONSTRAINT "bonus_entries_fund" CHECK ("hris"."bonus_entries"."fund" in ('OFFICE', 'DISCIPLINE_FUND')),
	CONSTRAINT "bonus_entries_period_start" CHECK (extract(day from "hris"."bonus_entries"."period_start") = 26),
	CONSTRAINT "bonus_entries_amount_sign" CHECK ("hris"."bonus_entries"."amount" >= 0 or "hris"."bonus_entries"."flag" = 'CORRECTION'),
	CONSTRAINT "bonus_entries_reason_needed" CHECK ("hris"."bonus_entries"."status" not in ('REJECTED', 'CANCELLED') or "hris"."bonus_entries"."reason" is not null),
	CONSTRAINT "bonus_entries_not_self" CHECK ("hris"."bonus_entries"."decided_by_employee_id" is null or "hris"."bonus_entries"."decided_by_employee_id" <> "hris"."bonus_entries"."employee_id")
);
--> statement-breakpoint
CREATE TABLE "hris"."bonus_pos_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"after" jsonb NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"reason" text,
	"correction_entry_id" integer,
	"decided_by_account_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonus_pos_changes_status" CHECK ("hris"."bonus_pos_changes"."status" in ('OPEN', 'ACCEPTED', 'IGNORED')),
	CONSTRAINT "bonus_pos_changes_decided" CHECK ("hris"."bonus_pos_changes"."status" = 'OPEN' or "hris"."bonus_pos_changes"."reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "hris"."pos_groomer_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"pos_groomer_id" integer NOT NULL,
	"employee_id" integer,
	"not_employee" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_account_id" integer,
	"release_reason" text,
	CONSTRAINT "pos_groomer_links_target" CHECK (("hris"."pos_groomer_links"."employee_id" is not null) <> "hris"."pos_groomer_links"."not_employee"),
	CONSTRAINT "pos_groomer_links_not_employee_note" CHECK (not "hris"."pos_groomer_links"."not_employee" or "hris"."pos_groomer_links"."note" is not null),
	CONSTRAINT "pos_groomer_links_release_complete" CHECK (("hris"."pos_groomer_links"."released_at" is null) = ("hris"."pos_groomer_links"."release_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_decided_by_employee_id_employees_id_fk" FOREIGN KEY ("decided_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."bonus_pos_changes" ADD CONSTRAINT "bonus_pos_changes_entry_id_bonus_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "hris"."bonus_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."bonus_pos_changes" ADD CONSTRAINT "bonus_pos_changes_correction_entry_id_bonus_entries_id_fk" FOREIGN KEY ("correction_entry_id") REFERENCES "hris"."bonus_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."pos_groomer_links" ADD CONSTRAINT "pos_groomer_links_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonus_entries_origin_live" ON "hris"."bonus_entries" USING btree ("origin_key") WHERE "hris"."bonus_entries"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "bonus_entries_employee_period_idx" ON "hris"."bonus_entries" USING btree ("employee_id","period_start");--> statement-breakpoint
CREATE INDEX "bonus_entries_period_idx" ON "hris"."bonus_entries" USING btree ("period_start","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "bonus_pos_changes_one_open" ON "hris"."bonus_pos_changes" USING btree ("entry_id") WHERE "hris"."bonus_pos_changes"."status" = 'OPEN';--> statement-breakpoint
CREATE UNIQUE INDEX "pos_groomer_links_one_active" ON "hris"."pos_groomer_links" USING btree ("pos_groomer_id") WHERE "hris"."pos_groomer_links"."released_at" is null;--> statement-breakpoint
CREATE INDEX "pos_groomer_links_employee_idx" ON "hris"."pos_groomer_links" USING btree ("employee_id");--> statement-breakpoint
-- Ditulis tangan (spec L4d §2): Buku Bonus tidak dihapus (PRI-02); salah = Ditolak/Dibatalkan dengan alasan.
CREATE TRIGGER bonus_entries_no_delete BEFORE DELETE ON hris.bonus_entries FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER bonus_entries_no_truncate BEFORE TRUNCATE ON hris.bonus_entries FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER bonus_pos_changes_no_delete BEFORE DELETE ON hris.bonus_pos_changes FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER pos_groomer_links_no_delete BEFORE DELETE ON hris.pos_groomer_links FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- View baca POS (PRD 01 §4 `v_jasa_grooming`, `v_ongkir`; spec L4d §2). hris_app tidak membaca schema petshop langsung.
-- Bahan nilai bersih baris (nilai baris, yang dibayar, jumlah baris nota) sama dengan laporan Grooming POS.
CREATE VIEW hris.pos_grooming_services AS
  SELECT g.id, g.status, g.branch_id AS kasir_branch_id, b.name AS kasir_branch_name, g.transaction_id, t.trx_number,
    coalesce(ti.product_name, 'Jasa grooming') AS service_name, g.groomer_id,
    (g.picked_up_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS picked_up_on,
    ti.total_price AS line_total, t.payable_amount,
    coalesce((SELECT sum(x.total_price) FROM petshop.transaction_items x WHERE x.transaction_id = g.transaction_id), 0)::integer AS lines_total,
    EXISTS (SELECT 1 FROM petshop.grooming_groomer_changes c WHERE c.grooming_order_id = g.id) AS groomer_changed
  FROM petshop.grooming_orders g
  JOIN petshop.transactions t ON t.id = g.transaction_id
  JOIN petshop.transaction_items ti ON ti.id = g.transaction_item_id
  JOIN petshop.branches b ON b.id = g.branch_id;
--> statement-breakpoint
CREATE VIEW hris.pos_deliveries AS
  SELECT d.id, d.status, d.branch_id AS kasir_branch_id, b.name AS kasir_branch_name, d.transaction_id, t.trx_number,
    d.courier_id, d.is_free_shipping, d.address IS NULL AS goods_only,
    (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS trx_on,
    ti.total_price AS line_total, t.payable_amount,
    coalesce((SELECT sum(x.total_price) FROM petshop.transaction_items x WHERE x.transaction_id = d.transaction_id), 0)::integer AS lines_total
  FROM petshop.service_deliveries d
  JOIN petshop.transactions t ON t.id = d.transaction_id
  JOIN petshop.transaction_items ti ON ti.id = d.transaction_item_id
  JOIN petshop.branches b ON b.id = d.branch_id;
--> statement-breakpoint
CREATE VIEW hris.pos_groomers AS
  SELECT id, name, is_active AS active, is_groomer, is_courier FROM petshop.groomers;
--> statement-breakpoint
-- Isi awal (harus ada di registry.ts, H18; spec L4d §3.1 dan §9 butir 4, 6).
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.bonus_grooming_percent', '10'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal (GAJ-61): 10% harga jasa sesudah diskon'),
  ('payroll.bonus_delivery_percent', '50'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal (spec L4d §9 butir 4, LOG-77): 50% ongkir sesudah diskon'),
  ('position.bonus_grooming', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4d §9 butir 6)'),
  ('position.bonus_delivery', '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4d §9 butir 6): semua jabatan kecuali Pemilik dan GM');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.bonus_grooming', 'POSITION', p.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4d §9 butir 6): penerima bonus grooming'
FROM hris.positions p
WHERE lower(p.name) IN ('groomer', 'pemilik');
--> statement-breakpoint
-- Hak awal (spec L4d §5). Pemilik/GM (full_access) memegang semua tindakan tanpa baris.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'bonus.view', 'ALL'), ('hr', 'bonus.approve', 'ALL'), ('hr', 'bonus.sync', 'ALL'),
  ('finance', 'bonus.view_totals', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
