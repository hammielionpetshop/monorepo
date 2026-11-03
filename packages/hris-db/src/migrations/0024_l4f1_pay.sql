CREATE TABLE "hris"."pay_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"paid_by_account_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"money_date" date NOT NULL,
	"date_reason" text,
	"proof_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."payment_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"method" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_sources_method" CHECK ("hris"."payment_sources"."method" in ('CASH', 'TRANSFER')),
	CONSTRAINT "payment_sources_name_not_blank" CHECK (btrim("hris"."payment_sources"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."payslip_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payslip_id" integer NOT NULL,
	"batch_id" integer,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"money_date" date NOT NULL,
	"method" text,
	"source_id" integer,
	"paid_by_account_id" integer NOT NULL,
	"breakdown" jsonb,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslip_payments_kind" CHECK ("hris"."payslip_payments"."kind" in ('MONEY', 'NO_MONEY')),
	CONSTRAINT "payslip_payments_status" CHECK ("hris"."payslip_payments"."status" in ('ACTIVE', 'CANCELLED')),
	CONSTRAINT "payslip_payments_money" CHECK ("hris"."payslip_payments"."kind" <> 'MONEY' or ("hris"."payslip_payments"."amount" > 0 and "hris"."payslip_payments"."batch_id" is not null and "hris"."payslip_payments"."source_id" is not null and "hris"."payslip_payments"."method" in ('CASH', 'TRANSFER'))),
	CONSTRAINT "payslip_payments_no_money" CHECK ("hris"."payslip_payments"."kind" <> 'NO_MONEY' or ("hris"."payslip_payments"."amount" = 0 and "hris"."payslip_payments"."batch_id" is null)),
	CONSTRAINT "payslip_payments_cancelled" CHECK (("hris"."payslip_payments"."status" = 'CANCELLED') = ("hris"."payslip_payments"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" DROP CONSTRAINT "payslip_steps_action";--> statement-breakpoint
ALTER TABLE "hris"."pay_batches" ADD CONSTRAINT "pay_batches_source_id_payment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "hris"."payment_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."pay_batches" ADD CONSTRAINT "pay_batches_proof_file_id_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD CONSTRAINT "payslip_payments_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "hris"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD CONSTRAINT "payslip_payments_batch_id_pay_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "hris"."pay_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."payslip_payments" ADD CONSTRAINT "payslip_payments_source_id_payment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "hris"."payment_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sources_name_unique" ON "hris"."payment_sources" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_payments_one_active" ON "hris"."payslip_payments" USING btree ("payslip_id") WHERE "hris"."payslip_payments"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "payslip_payments_batch_idx" ON "hris"."payslip_payments" USING btree ("batch_id");--> statement-breakpoint
ALTER TABLE "hris"."payslip_steps" ADD CONSTRAINT "payslip_steps_action" CHECK ("hris"."payslip_steps"."action" in ('CLOSE', 'PRINT', 'PRINT_MANY', 'REOPEN', 'REOPEN_REQUEST', 'EARLY_CLOSE', 'PAY', 'PAY_CANCEL', 'PAY_ZERO', 'TRANSFER_VIEW', 'TRANSFER_DOWNLOAD'));--> statement-breakpoint
-- Ditulis tangan (spec L4f §2): sumber uang, kelompok bayar, dan pembayaran tidak dihapus.
CREATE TRIGGER payment_sources_no_delete BEFORE DELETE ON hris.payment_sources FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER pay_batches_append_only BEFORE UPDATE OR DELETE ON hris.pay_batches FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER payslip_payments_no_delete BEFORE DELETE ON hris.payslip_payments FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Isi awal Sumber Uang (spec L4f §9 butir 2, keputusan owner 2026-11-03); diubah Pemilik/GM di Pengaturan › Sumber Uang.
INSERT INTO hris.payment_sources (name, method, sort_order) VALUES ('Brankas', 'CASH', 1), ('Rekening Kantor', 'TRANSFER', 2);
--> statement-breakpoint
-- Tanggal bayar gaji (GAJ-41, spec L4f §3.5): tanggal 1 sesudah periode berakhir.
INSERT INTO hris.setting_values (key, value, effective_from, status, reason) VALUES
  ('payroll.pay_day', '1'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3 (GAJ-41)');
--> statement-breakpoint
-- Hak awal L4f-1 (spec L4f §5). Bayar, Batal bayar, dan Sumber Uang hanya Pemilik/GM (full_access, tanpa baris).
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('finance', 'pay_schedule.view', 'ALL'), ('finance', 'transfer_list.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Slip bersih Rp0 yang sudah ditutup sebelum L4f: langsung Dibayar tanpa uang (GAJ-102, spec L4f §3.2).
INSERT INTO hris.payslip_payments (payslip_id, kind, amount, money_date, paid_by_account_id)
SELECT s.id, 'NO_MONEY', 0, (s.closed_at AT TIME ZONE 'Asia/Jakarta')::date, s.closed_by_account_id
FROM hris.payslips s
WHERE s.status = 'CLOSED' AND s.net = 0 AND s.closed_by_account_id IS NOT NULL;
