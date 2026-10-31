CREATE TYPE "hris"."deactivation_reason" AS ENUM('RESIGNED', 'DISMISSED', 'OTHER');--> statement-breakpoint
CREATE TYPE "hris"."employee_source" AS ENUM('HRIS', 'LEGACY', 'FIXTURE');--> statement-breakpoint
CREATE TYPE "hris"."employment_event_kind" AS ENUM('DEACTIVATE', 'REACTIVATE');--> statement-breakpoint
CREATE TYPE "hris"."field_permit_kind" AS ENUM('DRIVE', 'ASSIST');--> statement-breakpoint
CREATE TYPE "hris"."gender" AS ENUM('MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "hris"."placement_kind" AS ENUM('INITIAL', 'BRANCH', 'POSITION', 'WORK_STATUS');--> statement-breakpoint
CREATE TYPE "hris"."resignation_notice" AS ENUM('WITH_NOTICE', 'WITHOUT_NOTICE');--> statement-breakpoint
CREATE TYPE "hris"."training_decision" AS ENUM('APPROVE', 'DEFER');--> statement-breakpoint
CREATE TYPE "hris"."work_status" AS ENUM('TRAINING', 'EMPLOYEE');--> statement-breakpoint
CREATE TABLE "hris"."employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"joined_on" date NOT NULL,
	"phone" text,
	"email" text,
	"birth_date" date,
	"gender" "hris"."gender",
	"birth_place" text,
	"address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"religion" text,
	"marital_status" text,
	"dependents" integer,
	"education" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_holder" text,
	"source" "hris"."employee_source" DEFAULT 'HRIS' NOT NULL,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_name_not_blank" CHECK (btrim("hris"."employees"."name") <> ''),
	CONSTRAINT "employees_dependents_range" CHECK ("hris"."employees"."dependents" between 0 and 50)
);
--> statement-breakpoint
CREATE TABLE "hris"."employment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "hris"."employment_event_kind" NOT NULL,
	"effective_on" date NOT NULL,
	"reason_kind" "hris"."deactivation_reason",
	"resignation_notice" "hris"."resignation_notice",
	"note" text NOT NULL,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_applied_at" timestamp with time zone,
	CONSTRAINT "employment_events_reason_by_kind" CHECK (("hris"."employment_events"."kind" = 'DEACTIVATE') = ("hris"."employment_events"."reason_kind" is not null)),
	CONSTRAINT "employment_events_notice_only_resigned" CHECK (("hris"."employment_events"."resignation_notice" is not null) = ("hris"."employment_events"."reason_kind" is not distinct from 'RESIGNED')),
	CONSTRAINT "employment_events_note_not_blank" CHECK (btrim("hris"."employment_events"."note") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."field_permits" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "hris"."field_permit_kind" NOT NULL,
	"granted_by_account_id" integer NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_account_id" integer,
	"revoke_reason" text,
	CONSTRAINT "field_permits_revoke_complete" CHECK (("hris"."field_permits"."revoked_at" is null) = ("hris"."field_permits"."revoke_reason" is null) and ("hris"."field_permits"."revoked_at" is null) = ("hris"."field_permits"."revoked_by_account_id" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."placements" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "hris"."placement_kind" NOT NULL,
	"branch_id" integer NOT NULL,
	"position_id" integer NOT NULL,
	"work_status" "hris"."work_status" NOT NULL,
	"effective_from" date NOT NULL,
	"reason" text,
	"created_by_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" integer,
	"cancel_reason" text,
	CONSTRAINT "placements_cancel_complete" CHECK (("hris"."placements"."cancelled_at" is null) = ("hris"."placements"."cancel_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "hris"."training_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"decision" "hris"."training_decision" NOT NULL,
	"review_again_on" date,
	"promotion_effective_on" date,
	"placement_id" integer,
	"reason" text,
	"decided_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_reviews_shape" CHECK (case "hris"."training_reviews"."decision"
      when 'APPROVE' then "hris"."training_reviews"."promotion_effective_on" is not null and "hris"."training_reviews"."placement_id" is not null and "hris"."training_reviews"."review_again_on" is null
      else "hris"."training_reviews"."review_again_on" is not null and "hris"."training_reviews"."reason" is not null and btrim("hris"."training_reviews"."reason") <> '' and "hris"."training_reviews"."placement_id" is null end)
);
--> statement-breakpoint
ALTER TABLE "hris"."employment_events" ADD CONSTRAINT "employment_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."field_permits" ADD CONSTRAINT "field_permits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."placements" ADD CONSTRAINT "placements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."placements" ADD CONSTRAINT "placements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."placements" ADD CONSTRAINT "placements_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "hris"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."training_reviews" ADD CONSTRAINT "training_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."training_reviews" ADD CONSTRAINT "training_reviews_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "hris"."placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_code_unique" ON "hris"."employees" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_phone_unique" ON "hris"."employees" USING btree ("phone") WHERE "hris"."employees"."phone" is not null;--> statement-breakpoint
CREATE INDEX "employees_name_idx" ON "hris"."employees" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "employment_events_employee_idx" ON "hris"."employment_events" USING btree ("employee_id","effective_on");--> statement-breakpoint
CREATE INDEX "employment_events_pending_idx" ON "hris"."employment_events" USING btree ("effective_on") WHERE "hris"."employment_events"."account_applied_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "field_permits_one_active" ON "hris"."field_permits" USING btree ("employee_id","kind") WHERE "hris"."field_permits"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "placements_employee_date_idx" ON "hris"."placements" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE INDEX "placements_branch_date_idx" ON "hris"."placements" USING btree ("branch_id","effective_from");--> statement-breakpoint
CREATE INDEX "placements_position_idx" ON "hris"."placements" USING btree ("position_id");--> statement-breakpoint
CREATE UNIQUE INDEX "placements_one_initial" ON "hris"."placements" USING btree ("employee_id") WHERE "hris"."placements"."kind" = 'INITIAL';--> statement-breakpoint
CREATE INDEX "training_reviews_employee_idx" ON "hris"."training_reviews" USING btree ("employee_id","created_at");--> statement-breakpoint
-- Ditulis tangan (spec L2c §2): kode karyawan, pagar data riwayat, dan konversi tabel sementara L2b.
CREATE SEQUENCE "hris"."employee_code_seq" AS integer START 1;
--> statement-breakpoint
-- KAR-02: HML-0001; sesudah 9999 lanjut tanpa dipotong. Sequence tidak pernah memberi angka kembar.
CREATE FUNCTION "hris"."next_employee_code"() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'HML-' || lpad(n::text, greatest(4, length(n::text)), '0') FROM nextval('hris.employee_code_seq') AS n
$$;
--> statement-breakpoint
CREATE FUNCTION "hris"."guard_employee_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.code <> OLD.code OR NEW.source <> OLD.source THEN
    RAISE EXCEPTION 'Kode dan asal data karyawan tidak bisa diubah.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "employees_guard_update" BEFORE UPDATE ON "hris"."employees"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_employee_update"();
--> statement-breakpoint
-- Penempatan hanya boleh dibatalkan sekali, bukan INITIAL, dan hanya selama belum berlaku (KAR-56).
CREATE FUNCTION "hris"."guard_placement_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL OR NEW.cancelled_at IS NULL OR OLD.kind = 'INITIAL'
    OR OLD.effective_from <= (now() AT TIME ZONE 'Asia/Jakarta')::date
    OR (NEW.id, NEW.employee_id, NEW.kind, NEW.branch_id, NEW.position_id, NEW.work_status, NEW.effective_from,
        NEW.reason, NEW.created_by_account_id, NEW.created_at)
       IS DISTINCT FROM (OLD.id, OLD.employee_id, OLD.kind, OLD.branch_id, OLD.position_id, OLD.work_status,
        OLD.effective_from, OLD.reason, OLD.created_by_account_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Catatan penempatan tidak bisa diubah; hanya yang bertanggal depan boleh dibatalkan.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "placements_guard_update" BEFORE UPDATE ON "hris"."placements"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_placement_update"();
--> statement-breakpoint
CREATE FUNCTION "hris"."guard_employment_event_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.account_applied_at IS NOT NULL OR NEW.account_applied_at IS NULL
    OR (NEW.id, NEW.employee_id, NEW.kind, NEW.effective_on, NEW.reason_kind, NEW.resignation_notice, NEW.note,
        NEW.created_by_account_id, NEW.created_at)
       IS DISTINCT FROM (OLD.id, OLD.employee_id, OLD.kind, OLD.effective_on, OLD.reason_kind, OLD.resignation_notice,
        OLD.note, OLD.created_by_account_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Riwayat status tidak bisa diubah.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "employment_events_guard_update" BEFORE UPDATE ON "hris"."employment_events"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_employment_event_update"();
--> statement-breakpoint
CREATE FUNCTION "hris"."guard_field_permit_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
    OR (NEW.id, NEW.employee_id, NEW.kind, NEW.granted_by_account_id, NEW.granted_at)
       IS DISTINCT FROM (OLD.id, OLD.employee_id, OLD.kind, OLD.granted_by_account_id, OLD.granted_at) THEN
    RAISE EXCEPTION 'Izin tugas lapangan hanya bisa dicabut, tidak diubah.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "field_permits_guard_update" BEFORE UPDATE ON "hris"."field_permits"
  FOR EACH ROW EXECUTE FUNCTION "hris"."guard_field_permit_update"();
--> statement-breakpoint
CREATE TRIGGER "training_reviews_append_only" BEFORE UPDATE ON "hris"."training_reviews"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['employees', 'placements', 'employment_events', 'field_permits', 'training_reviews'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON hris.%I FOR EACH ROW EXECUTE FUNCTION hris.reject_change()',
      table_name || '_no_delete', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON hris.%I FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change()',
      table_name || '_no_truncate', table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Konversi penetapan jabatan sementara L2b menjadi karyawan fixture (spec L2c §7.5). id karyawan =
-- person_id (= local_user_id tautan HRIS), jadi tautan yang ada tetap menunjuk orang yang sama.
-- Produksi: tabel sementara kosong, tidak ada data dibuat.
DO $$
DECLARE
  item record;
  fallback_branch integer;
  label text;
BEGIN
  FOR item IN SELECT * FROM hris.interim_actor_positions ORDER BY person_id LOOP
    IF item.branch_id IS NULL AND fallback_branch IS NULL THEN
      SELECT id INTO fallback_branch FROM hris.branches WHERE active ORDER BY id LIMIT 1;
      IF fallback_branch IS NULL THEN
        INSERT INTO hris.branches (name) VALUES ('Kantor')
          ON CONFLICT DO NOTHING RETURNING id INTO fallback_branch;
        IF fallback_branch IS NULL THEN
          SELECT id INTO fallback_branch FROM hris.branches WHERE lower(name) = 'kantor';
        END IF;
      END IF;
    END IF;
    label := NULL;
    IF to_regclass('auth.account_links') IS NOT NULL THEN
      EXECUTE 'SELECT coalesce(a.username, a.email) FROM auth.account_links l JOIN auth.accounts a ON a.id = l.account_id
        WHERE l.app_code = ''hris'' AND l.local_user_id = $1 ORDER BY l.revoked_at NULLS FIRST LIMIT 1'
        INTO label USING item.person_id;
    END IF;
    INSERT INTO hris.employees (id, code, name, joined_on, source)
      VALUES (item.person_id, hris.next_employee_code(), coalesce(label, 'Karyawan fixture #' || item.person_id),
        (item.created_at AT TIME ZONE 'Asia/Jakarta')::date, 'FIXTURE');
    INSERT INTO hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from, reason)
      VALUES (item.person_id, 'INITIAL', coalesce(item.branch_id, fallback_branch), item.position_id, 'EMPLOYEE',
        (item.created_at AT TIME ZONE 'Asia/Jakarta')::date, 'Konversi penetapan jabatan sementara L2b (fixture).');
  END LOOP;
  PERFORM setval('hris.employees_id_seq', greatest(coalesce((SELECT max(id) FROM hris.employees), 0), 1),
    (SELECT count(*) > 0 FROM hris.employees));
END $$;
--> statement-breakpoint
DROP TABLE "hris"."interim_actor_positions" CASCADE;
--> statement-breakpoint
-- View baca untuk modul akses (spec L2c §3): penempatan hari ini (WIB) per karyawan dan status aktifnya.
-- Aturannya sama dengan employees/rules/placement.ts; tes integrasi memastikan keduanya cocok.
CREATE VIEW "hris"."current_placements" AS
  SELECT DISTINCT ON (p.employee_id)
    p.employee_id, e.name AS employee_name, e.code AS employee_code, p.branch_id, p.position_id, p.work_status,
    p.effective_from,
    coalesce((SELECT ev.kind FROM hris.employment_events ev
      WHERE ev.employee_id = p.employee_id AND ev.effective_on <= (now() AT TIME ZONE 'Asia/Jakarta')::date
      ORDER BY ev.effective_on DESC, ev.id DESC LIMIT 1), 'REACTIVATE') = 'REACTIVATE' AS active
  FROM hris.placements p JOIN hris.employees e ON e.id = p.employee_id
  WHERE p.cancelled_at IS NULL AND p.effective_from <= (now() AT TIME ZONE 'Asia/Jakarta')::date
  ORDER BY p.employee_id, p.effective_from DESC, p.id DESC;
--> statement-breakpoint
-- Pemakai cabang/jabatan untuk KAR-27: penempatan hari ini orang aktif, ditambah catatan bertanggal depan.
CREATE VIEW "hris"."placement_holders" AS
  SELECT employee_id, employee_name, branch_id, position_id, true AS current
  FROM hris.current_placements WHERE active
  UNION ALL
  SELECT p.employee_id, e.name, p.branch_id, p.position_id, false
  FROM hris.placements p JOIN hris.employees e ON e.id = p.employee_id
  WHERE p.cancelled_at IS NULL AND p.effective_from > (now() AT TIME ZONE 'Asia/Jakarta')::date;