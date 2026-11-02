CREATE TYPE "hris"."deduction_record_status" AS ENUM('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "hris"."cash_shortage_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"sequence" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_account_id" integer,
	"reviewed_at" timestamp with time zone,
	"approved_by_account_id" integer,
	"approved_by_employee_id" integer,
	"approved_at" timestamp with time zone,
	CONSTRAINT "cash_shortage_approvals_status" CHECK ("hris"."cash_shortage_approvals"."status" in ('OPEN', 'REVIEWED', 'APPROVED')),
	CONSTRAINT "cash_shortage_approvals_period_start" CHECK (extract(day from "hris"."cash_shortage_approvals"."period_start") = 26),
	CONSTRAINT "cash_shortage_approvals_not_self" CHECK ("hris"."cash_shortage_approvals"."approved_by_employee_id" is null or "hris"."cash_shortage_approvals"."approved_by_employee_id" <> "hris"."cash_shortage_approvals"."employee_id")
);
--> statement-breakpoint
CREATE TABLE "hris"."cash_shortages" (
	"id" serial PRIMARY KEY NOT NULL,
	"pos_shift_id" integer NOT NULL,
	"pos_shift_number" integer NOT NULL,
	"pos_user_id" integer NOT NULL,
	"kasir_branch_id" integer NOT NULL,
	"kasir_branch_name" text NOT NULL,
	"closed_on" date NOT NULL,
	"category" text NOT NULL,
	"shift_variance" integer,
	"cash" integer NOT NULL,
	"share_tenths" integer NOT NULL,
	"amount" integer NOT NULL,
	"approval_id" integer,
	"pos_changed_note" text,
	"waived_at" timestamp with time zone,
	"waived_by_account_id" integer,
	"waive_reason" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_shortages_category" CHECK ("hris"."cash_shortages"."category" in ('MINUS', 'PLUS', 'ANOMALY', 'TOLERATED')),
	CONSTRAINT "cash_shortages_waive_complete" CHECK (("hris"."cash_shortages"."waived_at" is null) = ("hris"."cash_shortages"."waive_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."inventory_losses" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"found_on" date NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"attachment_file_id" uuid NOT NULL,
	"status" "hris"."deduction_record_status" NOT NULL,
	"request_id" integer,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_account_id" integer,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "inventory_losses_amount_positive" CHECK ("hris"."inventory_losses"."amount" > 0),
	CONSTRAINT "inventory_losses_description_not_blank" CHECK (btrim("hris"."inventory_losses"."description") <> ''),
	CONSTRAINT "inventory_losses_active_approved" CHECK ("hris"."inventory_losses"."status" <> 'ACTIVE' or "hris"."inventory_losses"."approved_at" is not null),
	CONSTRAINT "inventory_losses_cancel_complete" CHECK (("hris"."inventory_losses"."status" = 'CANCELLED') = ("hris"."inventory_losses"."cancel_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."manual_cash_shortage_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"manual_cash_shortage_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "manual_cash_shortage_shares_non_negative" CHECK ("hris"."manual_cash_shortage_shares"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."manual_cash_shortages" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"named_employee_id" integer,
	"attachment_file_id" uuid,
	"status" "hris"."deduction_record_status" NOT NULL,
	"request_id" integer,
	"recorded_by_account_id" integer NOT NULL,
	"recorded_by_employee_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_account_id" integer,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "manual_cash_shortages_amount_positive" CHECK ("hris"."manual_cash_shortages"."amount" > 0),
	CONSTRAINT "manual_cash_shortages_reason_not_blank" CHECK (btrim("hris"."manual_cash_shortages"."reason") <> ''),
	CONSTRAINT "manual_cash_shortages_active_approved" CHECK ("hris"."manual_cash_shortages"."status" <> 'ACTIVE' or "hris"."manual_cash_shortages"."approved_at" is not null),
	CONSTRAINT "manual_cash_shortages_cancel_complete" CHECK (("hris"."manual_cash_shortages"."status" = 'CANCELLED') = ("hris"."manual_cash_shortages"."cancel_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."pos_cashier_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"pos_user_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_account_id" integer,
	"release_reason" text,
	CONSTRAINT "pos_cashier_links_release_complete" CHECK (("hris"."pos_cashier_links"."released_at" is null) = ("hris"."pos_cashier_links"."release_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."cash_shortage_approvals" ADD CONSTRAINT "cash_shortage_approvals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."cash_shortage_approvals" ADD CONSTRAINT "cash_shortage_approvals_approved_by_employee_id_employees_id_fk" FOREIGN KEY ("approved_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."cash_shortages" ADD CONSTRAINT "cash_shortages_approval_id_cash_shortage_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "hris"."cash_shortage_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."inventory_losses" ADD CONSTRAINT "inventory_losses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."inventory_losses" ADD CONSTRAINT "inventory_losses_attachment_file_id_files_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."inventory_losses" ADD CONSTRAINT "inventory_losses_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."inventory_losses" ADD CONSTRAINT "inventory_losses_recorded_by_employee_id_employees_id_fk" FOREIGN KEY ("recorded_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortage_shares" ADD CONSTRAINT "manual_cash_shortage_shares_manual_cash_shortage_id_manual_cash_shortages_id_fk" FOREIGN KEY ("manual_cash_shortage_id") REFERENCES "hris"."manual_cash_shortages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortage_shares" ADD CONSTRAINT "manual_cash_shortage_shares_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortages" ADD CONSTRAINT "manual_cash_shortages_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortages" ADD CONSTRAINT "manual_cash_shortages_named_employee_id_employees_id_fk" FOREIGN KEY ("named_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortages" ADD CONSTRAINT "manual_cash_shortages_attachment_file_id_files_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortages" ADD CONSTRAINT "manual_cash_shortages_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."manual_cash_shortages" ADD CONSTRAINT "manual_cash_shortages_recorded_by_employee_id_employees_id_fk" FOREIGN KEY ("recorded_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."pos_cashier_links" ADD CONSTRAINT "pos_cashier_links_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_shortage_approvals_unique" ON "hris"."cash_shortage_approvals" USING btree ("employee_id","period_start","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_shortages_shift_user_unique" ON "hris"."cash_shortages" USING btree ("pos_shift_id","pos_user_id");--> statement-breakpoint
CREATE INDEX "cash_shortages_closed_idx" ON "hris"."cash_shortages" USING btree ("closed_on");--> statement-breakpoint
CREATE INDEX "cash_shortages_approval_idx" ON "hris"."cash_shortages" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "inventory_losses_branch_date_idx" ON "hris"."inventory_losses" USING btree ("branch_id","found_on");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_losses_request_unique" ON "hris"."inventory_losses" USING btree ("request_id") WHERE "hris"."inventory_losses"."request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_cash_shortage_shares_unique" ON "hris"."manual_cash_shortage_shares" USING btree ("manual_cash_shortage_id","employee_id");--> statement-breakpoint
CREATE INDEX "manual_cash_shortages_date_idx" ON "hris"."manual_cash_shortages" USING btree ("occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_cash_shortages_request_unique" ON "hris"."manual_cash_shortages" USING btree ("request_id") WHERE "hris"."manual_cash_shortages"."request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_cashier_links_one_active" ON "hris"."pos_cashier_links" USING btree ("pos_user_id") WHERE "hris"."pos_cashier_links"."released_at" is null;--> statement-breakpoint
CREATE INDEX "pos_cashier_links_employee_idx" ON "hris"."pos_cashier_links" USING btree ("employee_id");--> statement-breakpoint
-- Ditulis tangan (spec L4c §2): catatan potongan tidak dihapus (PRI-02); salah = batal/ditolak dengan alasan.
CREATE TRIGGER inventory_losses_no_delete BEFORE DELETE ON hris.inventory_losses FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER inventory_losses_no_truncate BEFORE TRUNCATE ON hris.inventory_losses FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER manual_cash_shortages_no_delete BEFORE DELETE ON hris.manual_cash_shortages FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER manual_cash_shortages_no_truncate BEFORE TRUNCATE ON hris.manual_cash_shortages FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER manual_cash_shortage_shares_no_delete BEFORE DELETE ON hris.manual_cash_shortage_shares FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER cash_shortage_approvals_no_delete BEFORE DELETE ON hris.cash_shortage_approvals FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER pos_cashier_links_no_delete BEFORE DELETE ON hris.pos_cashier_links FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- View baca POS (PRD 01 §4 `v_selisih_kas`; spec L4c §2). hris_app tidak membaca schema petshop langsung.
-- Rumusnya sama dengan laporan Minus Kasir (apps/backoffice/lib/services/cashier-variance-service.ts):
-- hanya shift POS yang sudah tutup DAN diverifikasi Finance; tanggal kejadian = tanggal tutup WIB.
CREATE VIEW hris.pos_shift_variances AS
  SELECT s.id AS shift_id, s.shift_number, s.branch_id AS kasir_branch_id, b.name AS kasir_branch_name,
    (coalesce(s.closed_at, s.force_closed_at, s.opened_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date AS closed_on,
    s.total_closing_cash_expected AS expected_cash,
    coalesce(s.deposit_received_cash, 0) AS received_cash,
    CASE WHEN s.total_closing_cash_expected IS NULL THEN NULL
      ELSE coalesce(s.deposit_received_cash, 0) - s.total_closing_cash_expected END AS variance
  FROM petshop.shifts s JOIN petshop.branches b ON b.id = s.branch_id
  WHERE s.origin = 'POS' AND s.status IN ('CLOSED', 'FORCE_CLOSED') AND s.deposit_verified_at IS NOT NULL;
--> statement-breakpoint
-- Kas tunai per kasir per shift = penjualan tunai bersih kembalian + pelunasan piutang tunai yang belum dibatalkan.
CREATE VIEW hris.pos_shift_cash_shares AS
  WITH cash AS (
    SELECT scb.shift_id, scb.cashier_id, scb.total_sales_cash::bigint AS amount
    FROM petshop.shift_cashier_breakdown scb
    UNION ALL
    SELECT dp.shift_id, dp.created_by, sum(dp.amount)::bigint
    FROM petshop.debt_payments dp JOIN petshop.payment_methods pm ON pm.id = dp.payment_method_id
    WHERE dp.voided_at IS NULL AND pm.type = 'CASH' AND dp.created_by IS NOT NULL AND dp.shift_id IS NOT NULL
    GROUP BY dp.shift_id, dp.created_by
  )
  SELECT shift_id, cashier_id AS pos_user_id, sum(amount)::bigint AS cash FROM cash GROUP BY shift_id, cashier_id;
--> statement-breakpoint
CREATE VIEW hris.pos_users AS
  SELECT id, name, username, is_active AS active FROM petshop.users;
--> statement-breakpoint
-- Toleransi dan batas tak wajar milik laporan Minus Kasir (spec L4c §9 butir 2); kosong = bawaan di kode.
CREATE VIEW hris.pos_cashier_variance_settings AS
  SELECT value FROM petshop.app_settings WHERE key = 'cashier_variance_settings';
--> statement-breakpoint
-- Isi awal (harus ada di registry.ts, H18; spec L4c §3.1 dan §9 butir 7). Persen kantor per cabang dikosongkan:
-- baris ALL hanya isi wajib mesin pengaturan; kehilangan ditolak sampai cabangnya punya persen sendiri.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.loss_office_percent', '0'::jsonb, '2026-10-26', 'ACTIVE', 'Isi awal mesin; persen kantor diisi per cabang (spec L4c §9 butir 7)'),
  ('position.loss_sharing', '"NO"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4c §9 butir 7)'),
  ('position.loss_weight', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4c §9 butir 7)');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.loss_sharing', 'POSITION', p.id, '"YES"'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4c §9 butir 7): ikut menanggung kehilangan barang'
FROM hris.positions p
WHERE lower(p.name) IN ('kepala toko', 'kasir', 'pramuniaga', 'groomer', 'kepala gudang');
--> statement-breakpoint
INSERT INTO hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
SELECT 'position.loss_weight', 'POSITION', p.id, '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal (spec L4c §9 butir 7): bobot kepala 2'
FROM hris.positions p
WHERE lower(p.name) IN ('kepala toko', 'kepala gudang');
--> statement-breakpoint
-- Hak awal (spec L4c §5). Pemilik/GM (full_access) memegang semua tindakan tanpa baris.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'inventory_loss.view', 'ALL'), ('hr', 'inventory_loss.record', 'ALL'),
  ('hr', 'cash_shortage.view', 'ALL'), ('hr', 'cash_shortage.record', 'ALL'), ('hr', 'cash_shortage.review', 'ALL'),
  ('finance', 'cash_shortage.view', 'ALL'), ('finance', 'cash_shortage.record', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
