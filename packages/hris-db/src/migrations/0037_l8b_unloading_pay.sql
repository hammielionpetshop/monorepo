CREATE TABLE "hris"."unloading_overpayment_uses" (
	"id" serial PRIMARY KEY NOT NULL,
	"overpayment_id" integer NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"payment_id" integer,
	"source_id" integer,
	"money_date" date,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unloading_overpayment_uses_kind" CHECK ("hris"."unloading_overpayment_uses"."kind" in ('OFFSET', 'REFUND', 'CORRECTION', 'WRITE_OFF')),
	CONSTRAINT "unloading_overpayment_uses_amount" CHECK ("hris"."unloading_overpayment_uses"."amount" > 0),
	CONSTRAINT "unloading_overpayment_uses_status" CHECK ("hris"."unloading_overpayment_uses"."status" in ('ACTIVE', 'CANCELLED')),
	CONSTRAINT "unloading_overpayment_uses_offset" CHECK ("hris"."unloading_overpayment_uses"."kind" <> 'OFFSET' or "hris"."unloading_overpayment_uses"."payment_id" is not null),
	CONSTRAINT "unloading_overpayment_uses_refund" CHECK ("hris"."unloading_overpayment_uses"."kind" <> 'REFUND' or ("hris"."unloading_overpayment_uses"."source_id" is not null and "hris"."unloading_overpayment_uses"."money_date" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_overpayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"version" integer NOT NULL,
	"employee_id" integer,
	"casual_worker_id" integer,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"flagged_at" timestamp with time zone,
	"decided_by_account_id" integer,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unloading_overpayments_person" CHECK (("hris"."unloading_overpayments"."employee_id" is null) <> ("hris"."unloading_overpayments"."casual_worker_id" is null)),
	CONSTRAINT "unloading_overpayments_amount" CHECK ("hris"."unloading_overpayments"."amount" > 0),
	CONSTRAINT "unloading_overpayments_status" CHECK ("hris"."unloading_overpayments"."status" in ('OPEN', 'COLLECT', 'WRITTEN_OFF'))
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_payment_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"employee_id" integer,
	"casual_worker_id" integer,
	"name" text NOT NULL,
	"share" integer NOT NULL,
	"offset" integer DEFAULT 0 NOT NULL,
	"received" integer NOT NULL,
	CONSTRAINT "unloading_payment_lines_person" CHECK (("hris"."unloading_payment_lines"."employee_id" is null) <> ("hris"."unloading_payment_lines"."casual_worker_id" is null)),
	CONSTRAINT "unloading_payment_lines_sum" CHECK ("hris"."unloading_payment_lines"."share" >= 0 and "hris"."unloading_payment_lines"."offset" >= 0 and "hris"."unloading_payment_lines"."received" = "hris"."unloading_payment_lines"."share" - "hris"."unloading_payment_lines"."offset")
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"top_up_id" integer,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"money_date" date NOT NULL,
	"date_reason" text,
	"source_id" integer,
	"method" text,
	"paid_by_account_id" integer NOT NULL,
	"owner_flag" boolean DEFAULT false NOT NULL,
	"handed_to_name" text,
	"proof_file_id" uuid,
	"breakdown" jsonb,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "unloading_payments_kind" CHECK ("hris"."unloading_payments"."kind" in ('MONEY', 'NO_MONEY')),
	CONSTRAINT "unloading_payments_status" CHECK ("hris"."unloading_payments"."status" in ('ACTIVE', 'CANCELLED')),
	CONSTRAINT "unloading_payments_money" CHECK ("hris"."unloading_payments"."kind" <> 'MONEY' or ("hris"."unloading_payments"."amount" > 0 and "hris"."unloading_payments"."source_id" is not null and "hris"."unloading_payments"."method" in ('CASH', 'TRANSFER'))),
	CONSTRAINT "unloading_payments_no_money" CHECK ("hris"."unloading_payments"."kind" <> 'NO_MONEY' or "hris"."unloading_payments"."amount" = 0),
	CONSTRAINT "unloading_payments_cancelled" CHECK (("hris"."unloading_payments"."status" = 'CANCELLED') = ("hris"."unloading_payments"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_receipt_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"request_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_top_up_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"top_up_id" integer NOT NULL,
	"employee_id" integer,
	"casual_worker_id" integer,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "unloading_top_up_lines_person" CHECK (("hris"."unloading_top_up_lines"."employee_id" is null) <> ("hris"."unloading_top_up_lines"."casual_worker_id" is null)),
	CONSTRAINT "unloading_top_up_lines_amount" CHECK ("hris"."unloading_top_up_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "hris"."unloading_top_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "unloading_top_ups_status" CHECK ("hris"."unloading_top_ups"."status" in ('WAITING', 'PAID', 'CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "question" text;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "asked_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "asked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "answer" text;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "cancelled_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."unloading_reports" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayment_uses" ADD CONSTRAINT "unloading_overpayment_uses_overpayment_id_unloading_overpayments_id_fk" FOREIGN KEY ("overpayment_id") REFERENCES "hris"."unloading_overpayments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayment_uses" ADD CONSTRAINT "unloading_overpayment_uses_payment_id_unloading_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "hris"."unloading_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayment_uses" ADD CONSTRAINT "unloading_overpayment_uses_source_id_payment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "hris"."payment_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayments" ADD CONSTRAINT "unloading_overpayments_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayments" ADD CONSTRAINT "unloading_overpayments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_overpayments" ADD CONSTRAINT "unloading_overpayments_casual_worker_id_casual_workers_id_fk" FOREIGN KEY ("casual_worker_id") REFERENCES "hris"."casual_workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payment_lines" ADD CONSTRAINT "unloading_payment_lines_payment_id_unloading_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "hris"."unloading_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payment_lines" ADD CONSTRAINT "unloading_payment_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payment_lines" ADD CONSTRAINT "unloading_payment_lines_casual_worker_id_casual_workers_id_fk" FOREIGN KEY ("casual_worker_id") REFERENCES "hris"."casual_workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" ADD CONSTRAINT "unloading_payments_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" ADD CONSTRAINT "unloading_payments_top_up_id_unloading_top_ups_id_fk" FOREIGN KEY ("top_up_id") REFERENCES "hris"."unloading_top_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" ADD CONSTRAINT "unloading_payments_source_id_payment_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "hris"."payment_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_payments" ADD CONSTRAINT "unloading_payments_proof_file_id_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "hris"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_receipt_claims" ADD CONSTRAINT "unloading_receipt_claims_payment_id_unloading_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "hris"."unloading_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_receipt_claims" ADD CONSTRAINT "unloading_receipt_claims_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_receipt_claims" ADD CONSTRAINT "unloading_receipt_claims_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_top_up_lines" ADD CONSTRAINT "unloading_top_up_lines_top_up_id_unloading_top_ups_id_fk" FOREIGN KEY ("top_up_id") REFERENCES "hris"."unloading_top_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_top_up_lines" ADD CONSTRAINT "unloading_top_up_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_top_up_lines" ADD CONSTRAINT "unloading_top_up_lines_casual_worker_id_casual_workers_id_fk" FOREIGN KEY ("casual_worker_id") REFERENCES "hris"."casual_workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."unloading_top_ups" ADD CONSTRAINT "unloading_top_ups_report_id_unloading_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "hris"."unloading_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unloading_overpayment_uses_overpayment_idx" ON "hris"."unloading_overpayment_uses" USING btree ("overpayment_id");--> statement-breakpoint
CREATE INDEX "unloading_overpayments_employee_idx" ON "hris"."unloading_overpayments" USING btree ("employee_id") WHERE "hris"."unloading_overpayments"."employee_id" is not null;--> statement-breakpoint
CREATE INDEX "unloading_overpayments_casual_idx" ON "hris"."unloading_overpayments" USING btree ("casual_worker_id") WHERE "hris"."unloading_overpayments"."casual_worker_id" is not null;--> statement-breakpoint
CREATE INDEX "unloading_payment_lines_payment_idx" ON "hris"."unloading_payment_lines" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "unloading_payment_lines_employee_idx" ON "hris"."unloading_payment_lines" USING btree ("employee_id") WHERE "hris"."unloading_payment_lines"."employee_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_payments_one_active_report" ON "hris"."unloading_payments" USING btree ("report_id") WHERE "hris"."unloading_payments"."status" = 'ACTIVE' and "hris"."unloading_payments"."top_up_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_payments_one_active_top_up" ON "hris"."unloading_payments" USING btree ("top_up_id") WHERE "hris"."unloading_payments"."status" = 'ACTIVE' and "hris"."unloading_payments"."top_up_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "unloading_receipt_claims_request_unique" ON "hris"."unloading_receipt_claims" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "unloading_top_up_lines_top_up_idx" ON "hris"."unloading_top_up_lines" USING btree ("top_up_id");--> statement-breakpoint
CREATE INDEX "unloading_top_ups_report_idx" ON "hris"."unloading_top_ups" USING btree ("report_id");
--> statement-breakpoint
-- Ditulis tangan (spec L8 §2, §3.4–3.5): uang bongkaran tidak dihapus dan angkanya tidak diubah (PRI-02, DRV-83).
CREATE TRIGGER unloading_top_ups_no_delete BEFORE DELETE ON hris.unloading_top_ups FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_top_up_lines_no_change BEFORE UPDATE OR DELETE ON hris.unloading_top_up_lines FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_payments_no_delete BEFORE DELETE ON hris.unloading_payments FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_payment_lines_no_change BEFORE UPDATE OR DELETE ON hris.unloading_payment_lines FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_overpayments_no_delete BEFORE DELETE ON hris.unloading_overpayments FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_overpayment_uses_no_delete BEFORE DELETE ON hris.unloading_overpayment_uses FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER unloading_receipt_claims_no_change BEFORE UPDATE OR DELETE ON hris.unloading_receipt_claims FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Pembayaran: hanya pembatalan yang boleh mengubah baris; pembayaran batal tidak hidup lagi.
CREATE FUNCTION hris.unloading_payments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.report_id, NEW.top_up_id, NEW.kind, NEW.amount, NEW.money_date, NEW.source_id, NEW.method, NEW.paid_by_account_id, NEW.created_at)
     IS DISTINCT FROM (OLD.report_id, OLD.top_up_id, OLD.kind, OLD.amount, OLD.money_date, OLD.source_id, OLD.method, OLD.paid_by_account_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Pembayaran bongkaran tidak boleh diubah; batal bayar lalu bayar ulang.';
  END IF;
  IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    RAISE EXCEPTION 'Pembayaran bongkaran yang batal tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER unloading_payments_guard BEFORE UPDATE ON hris.unloading_payments FOR EACH ROW EXECUTE FUNCTION hris.unloading_payments_guard();
--> statement-breakpoint
-- Lebih bayar dan pemakaiannya: nominal dan orang terkunci; pemakaian hanya boleh dibatalkan.
CREATE FUNCTION hris.unloading_overpayments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.report_id, NEW.employee_id, NEW.casual_worker_id, NEW.amount, NEW.created_at) IS DISTINCT FROM (OLD.report_id, OLD.employee_id, OLD.casual_worker_id, OLD.amount, OLD.created_at) THEN
    RAISE EXCEPTION 'Lebih bayar bongkaran tidak boleh diubah.';
  END IF;
  IF OLD.status = 'WRITTEN_OFF' AND NEW.status <> 'WRITTEN_OFF' THEN
    RAISE EXCEPTION 'Lebih bayar yang dihapus tidak bisa dihidupkan lagi.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER unloading_overpayments_guard BEFORE UPDATE ON hris.unloading_overpayments FOR EACH ROW EXECUTE FUNCTION hris.unloading_overpayments_guard();
--> statement-breakpoint
CREATE FUNCTION hris.unloading_overpayment_uses_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.overpayment_id, NEW.kind, NEW.amount, NEW.payment_id, NEW.source_id, NEW.money_date) IS DISTINCT FROM (OLD.overpayment_id, OLD.kind, OLD.amount, OLD.payment_id, OLD.source_id, OLD.money_date)
     OR (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED') THEN
    RAISE EXCEPTION 'Pemakaian lebih bayar hanya boleh dibatalkan.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER unloading_overpayment_uses_guard BEFORE UPDATE ON hris.unloading_overpayment_uses FOR EACH ROW EXECUTE FUNCTION hris.unloading_overpayment_uses_guard();
