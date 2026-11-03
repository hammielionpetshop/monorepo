CREATE TABLE "hris"."bonus_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_fund" text DEFAULT 'OFFICE' NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonus_types_name_not_blank" CHECK (btrim("hris"."bonus_types"."name") <> ''),
	CONSTRAINT "bonus_types_default_fund" CHECK ("hris"."bonus_types"."default_fund" in ('OFFICE', 'DISCIPLINE_FUND'))
);
--> statement-breakpoint
CREATE TABLE "hris"."fund_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"fund" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"branch_id" integer,
	"period_start" date,
	"reason" text NOT NULL,
	"transfer_group" uuid,
	"bonus_entry_id" integer,
	"created_by_account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fund_entries_fund" CHECK ("hris"."fund_entries"."fund" in ('DISCIPLINE', 'ABSENCE')),
	CONSTRAINT "fund_entries_kind" CHECK ("hris"."fund_entries"."kind" in ('OPENING', 'ADJUSTMENT', 'TRANSFER')),
	CONSTRAINT "fund_entries_amount" CHECK ("hris"."fund_entries"."amount" <> 0 or "hris"."fund_entries"."kind" = 'OPENING'),
	CONSTRAINT "fund_entries_opening_positive" CHECK ("hris"."fund_entries"."kind" <> 'OPENING' or "hris"."fund_entries"."amount" >= 0),
	CONSTRAINT "fund_entries_reason_not_blank" CHECK (btrim("hris"."fund_entries"."reason") <> ''),
	CONSTRAINT "fund_entries_transfer_group" CHECK (("hris"."fund_entries"."kind" = 'TRANSFER') = ("hris"."fund_entries"."transfer_group" is not null))
);
--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" DROP CONSTRAINT "bonus_entries_kind";--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD COLUMN "type_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD COLUMN "request_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD COLUMN "recorded_by_account_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD COLUMN "recorded_by_employee_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "hris"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."fund_entries" ADD CONSTRAINT "fund_entries_bonus_entry_id_bonus_entries_id_fk" FOREIGN KEY ("bonus_entry_id") REFERENCES "hris"."bonus_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonus_types_name_unique" ON "hris"."bonus_types" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "fund_entries_fund_idx" ON "hris"."fund_entries" USING btree ("fund","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fund_entries_one_opening" ON "hris"."fund_entries" USING btree ("fund") WHERE "hris"."fund_entries"."kind" = 'OPENING';--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_type_id_bonus_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "hris"."bonus_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hris"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_recorded_by_employee_id_employees_id_fk" FOREIGN KEY ("recorded_by_employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonus_entries_request_unique" ON "hris"."bonus_entries" USING btree ("request_id") WHERE "hris"."bonus_entries"."request_id" is not null;--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_typed_type" CHECK (("hris"."bonus_entries"."kind" = 'TYPED') = ("hris"."bonus_entries"."type_id" is not null));--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_not_self_recorded" CHECK ("hris"."bonus_entries"."recorded_by_employee_id" is null or "hris"."bonus_entries"."recorded_by_employee_id" <> "hris"."bonus_entries"."employee_id");--> statement-breakpoint
ALTER TABLE "hris"."bonus_entries" ADD CONSTRAINT "bonus_entries_kind" CHECK ("hris"."bonus_entries"."kind" in ('GROOMING', 'DELIVERY', 'TYPED'));--> statement-breakpoint
-- Ditulis tangan (spec L4d §2, §3.4): mutasi dana tidak diubah dan tidak dihapus; salah isi = penyesuaian baru.
CREATE TRIGGER fund_entries_append_only BEFORE UPDATE OR DELETE ON hris.fund_entries FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER fund_entries_no_truncate BEFORE TRUNCATE ON hris.fund_entries FOR EACH STATEMENT EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
CREATE TRIGGER bonus_types_no_delete BEFORE DELETE ON hris.bonus_types FOR EACH ROW EXECUTE FUNCTION hris.reject_change();
--> statement-breakpoint
-- Isi awal jenis ketik (spec L4d §3.1): Bonus Bebas, sumber dana bawaan uang kantor.
INSERT INTO hris.bonus_types (name, default_fund, sort_order) VALUES ('Bonus Bebas', 'OFFICE', 1);
--> statement-breakpoint
-- Hak awal L4d-2 (spec L4d §5). Pemilik/GM (full_access) memegang semua tindakan tanpa baris.
INSERT INTO hris.position_grants (position_id, action, scope)
SELECT p.id, g.action, g.scope::hris.access_scope
FROM hris.positions p
JOIN (VALUES
  ('hr', 'bonus.record_free', 'ALL'), ('hr', 'fund.view', 'ALL'), ('finance', 'fund.view', 'ALL')
) AS g(position_name, action, scope) ON lower(p.name) = g.position_name
ON CONFLICT DO NOTHING;
