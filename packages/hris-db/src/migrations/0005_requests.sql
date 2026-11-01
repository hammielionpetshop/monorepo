CREATE TYPE "hris"."request_status" AS ENUM('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "hris"."identity_changes" (
	"request_id" integer PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."request_attachments" (
	"request_id" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_attachments_request_id_file_id_pk" PRIMARY KEY("request_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "hris"."request_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"from_status" "hris"."request_status",
	"to_status" "hris"."request_status" NOT NULL,
	"actor_account_id" integer NOT NULL,
	"actor_employee_id" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_key" text NOT NULL,
	"subject_employee_id" integer NOT NULL,
	"submitted_by_account_id" integer NOT NULL,
	"submitted_by_employee_id" integer NOT NULL,
	"status" "hris"."request_status" DEFAULT 'PENDING' NOT NULL,
	"summary" text NOT NULL,
	"branch_id" integer,
	"dedupe_key" text,
	"resubmitted_from_id" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_account_id" integer,
	"decided_by_employee_id" integer,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "requests_summary_not_blank" CHECK (btrim("hris"."requests"."summary") <> ''),
	CONSTRAINT "requests_reason_when_needed" CHECK ("hris"."requests"."status" not in ('REJECTED', 'REVOKED')
      or btrim(coalesce("hris"."requests"."decision_reason", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_account_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"entity" text,
	"entity_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_title_not_blank" CHECK (btrim("hris"."notifications"."title") <> ''),
	CONSTRAINT "notifications_link_internal" CHECK ("hris"."notifications"."link" is null or "hris"."notifications"."link" like '/%')
);
--> statement-breakpoint
CREATE TABLE "hris"."files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_mime_allowed" CHECK ("hris"."files"."mime" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "files_size_range" CHECK ("hris"."files"."size_bytes" between 1 and 10485760)
);
--> statement-breakpoint
ALTER TABLE "hris"."identity_changes" ADD CONSTRAINT "identity_changes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."request_attachments" ADD CONSTRAINT "request_attachments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."request_events" ADD CONSTRAINT "request_events_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_changes_employee_idx" ON "hris"."identity_changes" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "request_events_request_idx" ON "hris"."request_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "requests_subject_idx" ON "hris"."requests" USING btree ("subject_employee_id","submitted_at");--> statement-breakpoint
CREATE INDEX "requests_open_idx" ON "hris"."requests" USING btree ("type_key","submitted_at") WHERE "hris"."requests"."status" in ('PENDING', 'REVIEWED');--> statement-breakpoint
CREATE UNIQUE INDEX "requests_one_open_per_key" ON "hris"."requests" USING btree ("type_key","dedupe_key") WHERE "hris"."requests"."dedupe_key" is not null and "hris"."requests"."status" in ('PENDING', 'REVIEWED');--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "hris"."notifications" USING btree ("recipient_account_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "hris"."notifications" USING btree ("recipient_account_id") WHERE "hris"."notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "hris"."notifications" USING btree ("created_at");--> statement-breakpoint
-- Ditulis tangan (spec L2f-1 §2): pagar Mesin Pengajuan, berkas, pemberitahuan, dan isi awal pengaturan.
-- Isi pengajuan tidak bisa diubah; yang berpindah hanya status + keputusan, dengan versi naik satu (PRI-37, PRI-02).
-- Daftar perpindahan sah harus sama dengan apps/hris/modules/requests/rules/status.ts (dites).
CREATE FUNCTION "hris"."guard_request_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.type_key, NEW.subject_employee_id, NEW.submitted_by_account_id, NEW.submitted_by_employee_id, NEW.summary,
      NEW.branch_id, NEW.dedupe_key, NEW.resubmitted_from_id, NEW.submitted_at)
     IS DISTINCT FROM
     (OLD.type_key, OLD.subject_employee_id, OLD.submitted_by_account_id, OLD.submitted_by_employee_id, OLD.summary,
      OLD.branch_id, OLD.dedupe_key, OLD.resubmitted_from_id, OLD.submitted_at) THEN
    RAISE EXCEPTION 'Isi pengajuan tidak boleh diubah.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NOT (
       (OLD.status = 'PENDING' AND NEW.status IN ('REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'))
    OR (OLD.status = 'REVIEWED' AND NEW.status IN ('APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'))
    OR (OLD.status = 'APPROVED' AND NEW.status IN ('REVOKED', 'CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Perubahan status pengajuan % ke % tidak diizinkan.', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Versi pengajuan harus naik satu.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "requests_guard_update" BEFORE UPDATE ON "hris"."requests"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_request_update"();
--> statement-breakpoint
CREATE TRIGGER "requests_no_delete" BEFORE DELETE ON "hris"."requests"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "requests_no_truncate" BEFORE TRUNCATE ON "hris"."requests"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "request_events_append_only" BEFORE UPDATE OR DELETE ON "hris"."request_events"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "request_events_no_truncate" BEFORE TRUNCATE ON "hris"."request_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "request_attachments_append_only" BEFORE UPDATE OR DELETE ON "hris"."request_attachments"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "request_attachments_no_truncate" BEFORE TRUNCATE ON "hris"."request_attachments"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "files_append_only" BEFORE UPDATE OR DELETE ON "hris"."files"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "files_no_truncate" BEFORE TRUNCATE ON "hris"."files"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
-- Isi khas Ubah data diri: tidak dihapus; hanya `applied_at` diisi sekali saat disetujui.
CREATE FUNCTION "hris"."guard_identity_change_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.request_id, NEW.employee_id, NEW.before, NEW.after, NEW.created_at)
     IS DISTINCT FROM (OLD.request_id, OLD.employee_id, OLD.before, OLD.after, OLD.created_at)
     OR OLD.applied_at IS NOT NULL OR NEW.applied_at IS NULL THEN
    RAISE EXCEPTION 'Isi pengajuan ubah data diri tidak boleh diubah.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "identity_changes_guard_update" BEFORE UPDATE ON "hris"."identity_changes"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_identity_change_update"();
--> statement-breakpoint
CREATE TRIGGER "identity_changes_no_delete" BEFORE DELETE ON "hris"."identity_changes"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
-- Pemberitahuan: hanya ditandai terbaca sekali; dibuang hanya bila lebih dari 90 hari (BER-L02).
CREATE FUNCTION "hris"."guard_notification_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.created_at >= now() - interval '90 days' THEN
      RAISE EXCEPTION 'Pemberitahuan baru dibuang setelah 90 hari.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW.recipient_account_id, NEW.kind, NEW.title, NEW.body, NEW.link, NEW.entity, NEW.entity_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.recipient_account_id, OLD.kind, OLD.title, OLD.body, OLD.link, OLD.entity, OLD.entity_id, OLD.created_at)
     OR OLD.read_at IS NOT NULL OR NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'Pemberitahuan hanya bisa ditandai terbaca.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "notifications_guard" BEFORE UPDATE OR DELETE ON "hris"."notifications"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_notification_change"();
--> statement-breakpoint
-- Isi awal "Pengajuan dianggap lama menunggu" (PRI-37 butir 4: 2 hari). Harus sama dengan
-- apps/hris/modules/settings/rules/registry.ts (H18).
INSERT INTO "hris"."setting_values" (key, value, effective_from, status, reason)
VALUES ('requests.overdue_days', '2'::jsonb, '2026-01-01', 'ACTIVE', 'Isi awal buku aturan v3');
