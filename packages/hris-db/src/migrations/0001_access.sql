CREATE TYPE "hris"."access_scope" AS ENUM('SELF', 'BRANCH', 'DEPARTMENT', 'ALL');--> statement-breakpoint
CREATE TABLE "hris"."audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_account_id" integer NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"kasir_branch_id" integer,
	"merged_into_branch_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_name_not_blank" CHECK (btrim("hris"."branches"."name") <> ''),
	CONSTRAINT "branches_location_pair" CHECK (("hris"."branches"."latitude" is null) = ("hris"."branches"."longitude" is null)),
	CONSTRAINT "branches_latitude_range" CHECK ("hris"."branches"."latitude" between -90 and 90),
	CONSTRAINT "branches_longitude_range" CHECK ("hris"."branches"."longitude" between -180 and 180),
	CONSTRAINT "branches_not_merged_into_self" CHECK ("hris"."branches"."merged_into_branch_id" <> "hris"."branches"."id")
);
--> statement-breakpoint
CREATE TABLE "hris"."departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_not_blank" CHECK (btrim("hris"."departments"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "hris"."interim_actor_positions" (
	"person_id" integer PRIMARY KEY NOT NULL,
	"position_id" integer NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."position_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_id" integer NOT NULL,
	"action" text NOT NULL,
	"scope" "hris"."access_scope" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris"."positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"department_id" integer NOT NULL,
	"high_rights" boolean DEFAULT false NOT NULL,
	"full_access" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_name_not_blank" CHECK (btrim("hris"."positions"."name") <> ''),
	CONSTRAINT "positions_full_access_is_high_rights" CHECK (not "hris"."positions"."full_access" or "hris"."positions"."high_rights")
);
--> statement-breakpoint
ALTER TABLE "hris"."branches" ADD CONSTRAINT "branches_merged_into_branch_id_branches_id_fk" FOREIGN KEY ("merged_into_branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."interim_actor_positions" ADD CONSTRAINT "interim_actor_positions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "hris"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."interim_actor_positions" ADD CONSTRAINT "interim_actor_positions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."position_grants" ADD CONSTRAINT "position_grants_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "hris"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "hris"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "hris"."audit_events" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_name_unique" ON "hris"."branches" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "branches_kasir_branch_unique" ON "hris"."branches" USING btree ("kasir_branch_id") WHERE "hris"."branches"."kasir_branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_unique" ON "hris"."departments" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "position_grants_position_action_unique" ON "hris"."position_grants" USING btree ("position_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_name_unique" ON "hris"."positions" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "positions_department_idx" ON "hris"."positions" USING btree ("department_id");--> statement-breakpoint
-- Ditulis tangan (spec L2b §2): pagar data, view cabang kasir, dan data awal.
CREATE FUNCTION "hris"."reject_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% pada hris.% tidak diizinkan: data ini tidak boleh dihapus atau diubah.', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END $$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_append_only" BEFORE UPDATE OR DELETE ON "hris"."audit_events"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_truncate" BEFORE TRUNCATE ON "hris"."audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "departments_no_delete" BEFORE DELETE ON "hris"."departments"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "branches_no_delete" BEFORE DELETE ON "hris"."branches"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
CREATE TRIGGER "positions_no_delete" BEFORE DELETE ON "hris"."positions"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_change"();
--> statement-breakpoint
-- Jabatan full_access (Pemilik, GM) tidak punya baris hak: hak penuhnya dari bendera (KAR-67/71).
CREATE FUNCTION "hris"."reject_full_access_grant"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hris"."positions" WHERE id = NEW.position_id AND full_access) THEN
    RAISE EXCEPTION 'Jabatan berhak penuh tidak memakai baris hak.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "position_grants_not_full_access" BEFORE INSERT OR UPDATE ON "hris"."position_grants"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_full_access_grant"();
--> statement-breakpoint
CREATE FUNCTION "hris"."reject_full_access_with_grants"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.full_access AND EXISTS (SELECT 1 FROM "hris"."position_grants" WHERE position_id = NEW.id) THEN
    RAISE EXCEPTION 'Jabatan yang masih punya baris hak tidak bisa dijadikan berhak penuh.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "positions_full_access_without_grants" BEFORE UPDATE OF "full_access" ON "hris"."positions"
  FOR EACH ROW EXECUTE FUNCTION "hris"."reject_full_access_with_grants"();
--> statement-breakpoint
-- Cabang kasir untuk ditautkan ke cabang HRIS; hris_app tidak membaca schema petshop langsung.
CREATE VIEW "hris"."kasir_branches" AS
  SELECT id, code, name, is_active AS active FROM "petshop"."branches";
--> statement-breakpoint
INSERT INTO "hris"."departments" ("name") VALUES ('Office'), ('Team Gudang'), ('Team Toko')
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "hris"."positions" ("name", "department_id", "high_rights", "full_access")
SELECT p.name, d.id, p.high_rights, p.full_access
FROM (VALUES
  ('Pemilik', 'Office', true, true),
  ('GM', 'Office', true, true),
  ('HR', 'Office', true, false),
  ('Admin HR', 'Office', false, false),
  ('Finance', 'Office', true, false),
  ('Marketing', 'Office', false, false),
  ('Kepala Gudang', 'Team Gudang', false, false),
  ('Driver', 'Team Gudang', false, false),
  ('Kenek', 'Team Gudang', false, false),
  ('Kepala Toko', 'Team Toko', false, false),
  ('Kasir', 'Team Toko', false, false),
  ('Pramuniaga', 'Team Toko', false, false),
  ('Groomer', 'Team Toko', false, false)
) AS p(name, department, high_rights, full_access)
JOIN "hris"."departments" d ON lower(d.name) = lower(p.department)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Hak awal (spec karyawan-dan-akses v3 §5). "Semua karyawan" = setiap jabatan bukan full_access;
-- baris jabatan tertentu menimpa lingkup "semua karyawan" untuk tindakan yang sama.
INSERT INTO "hris"."position_grants" ("position_id", "action", "scope")
SELECT p.id, g.action, g.scope::"hris"."access_scope"
FROM "hris"."positions" p
CROSS JOIN (VALUES
  ('profile.view', 'SELF'),
  ('contact.update_own', 'SELF'),
  ('identity_change.request', 'SELF'),
  ('own_account.manage', 'SELF'),
  ('extra_rights.view', 'SELF'),
  ('report_guide.view', 'ALL'),
  ('login_history.view_own', 'SELF')
) AS g(action, scope)
WHERE NOT p.full_access
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "hris"."position_grants" ("position_id", "action", "scope")
SELECT p.id, g.action, g.scope::"hris"."access_scope"
FROM (VALUES
  ('hr'), ('admin hr')
) AS h(position)
JOIN "hris"."positions" p ON lower(p.name) = h.position
CROSS JOIN (VALUES
  ('profile.view', 'ALL'),
  ('identity_change.decide', 'ALL'),
  ('employee.list', 'ALL'),
  ('employee.update', 'ALL'),
  ('placement.record', 'ALL'),
  ('employee.activation', 'ALL'),
  ('resignation.propose_unnotified', 'ALL'),
  ('field_permit.update', 'ALL'),
  ('registration.decide', 'ALL'),
  ('training_promotion.decide', 'ALL'),
  ('freelancer.manage', 'ALL'),
  ('sessions.revoke', 'ALL'),
  ('position_settings.propose', 'ALL'),
  ('org.manage', 'ALL')
) AS g(action, scope)
ON CONFLICT ("position_id", "action") DO UPDATE SET "scope" = EXCLUDED."scope";
--> statement-breakpoint
INSERT INTO "hris"."position_grants" ("position_id", "action", "scope")
SELECT p.id, g.action, g.scope::"hris"."access_scope"
FROM (VALUES
  ('finance', 'temp_report_right.grant', 'ALL'),
  ('finance', 'extra_rights.view', 'ALL'),
  ('kepala gudang', 'employee.directory', 'ALL'),
  ('kepala gudang', 'field_permit.update', 'ALL'),
  ('kepala gudang', 'freelancer.manage', 'ALL')
) AS g(position, action, scope)
JOIN "hris"."positions" p ON lower(p.name) = g.position
ON CONFLICT ("position_id", "action") DO UPDATE SET "scope" = EXCLUDED."scope";