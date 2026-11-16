ALTER TABLE "hris"."announcement_drafts" ADD COLUMN "setting_value_ids" integer[];--> statement-breakpoint
ALTER TABLE "hris"."announcement_drafts" ADD COLUMN "trip_rate_id" integer;--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "setting_value_ids" integer[];--> statement-breakpoint
ALTER TABLE "hris"."announcements" ADD COLUMN "trip_rate_id" integer;--> statement-breakpoint
CREATE INDEX "announcements_setting_values_idx" ON "hris"."announcements" USING gin ("setting_value_ids");--> statement-breakpoint
CREATE INDEX "announcements_trip_rate_idx" ON "hris"."announcements" USING btree ("trip_rate_id");--> statement-breakpoint
-- Ditulis tangan: kolom kaitan wajib umumkan ikut dijaga "tidak diubah, tidak dihapus" (spec F3-3 §4.2).
CREATE OR REPLACE FUNCTION "hris"."guard_announcement_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pengumuman tidak boleh dihapus.';
  END IF;
  IF OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL
    OR ROW(NEW.id, NEW.kind, NEW.title, NEW.message, NEW.target_all, NEW.shows_from, NEW.shows_until,
           NEW.created_by_account_id, NEW.created_by_employee_id, NEW.created_at,
           NEW.before_text, NEW.ask_whom, NEW.effective_on, NEW.change_kind, NEW.affects_money,
           NEW.corrects_announcement_id, NEW.supersedes_announcement_id, NEW.approved_by_account_id, NEW.request_id,
           NEW.setting_value_ids, NEW.trip_rate_id)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.kind, OLD.title, OLD.message, OLD.target_all, OLD.shows_from, OLD.shows_until,
           OLD.created_by_account_id, OLD.created_by_employee_id, OLD.created_at,
           OLD.before_text, OLD.ask_whom, OLD.effective_on, OLD.change_kind, OLD.affects_money,
           OLD.corrects_announcement_id, OLD.supersedes_announcement_id, OLD.approved_by_account_id, OLD.request_id,
           OLD.setting_value_ids, OLD.trip_rate_id) THEN
    RAISE EXCEPTION 'Pengumuman tidak boleh diubah; yang boleh hanya mengakhiri/menariknya sekali.';
  END IF;
  RETURN NEW;
END $$;
