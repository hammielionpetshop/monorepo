ALTER TABLE "hris"."notifications" ADD COLUMN "popup_acked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_popup_idx" ON "hris"."notifications" USING btree ("recipient_account_id","created_at") WHERE "hris"."notifications"."popup_acked_at" is null and "hris"."notifications"."read_at" is null;--> statement-breakpoint
-- Ditulis tangan: penjaga pemberitahuan kini juga membolehkan `popup_acked_at` diisi sekali (spec F3-4 §6).
-- `read_at` dan `popup_acked_at` masing-masing hanya boleh dari kosong menjadi terisi; kolom lain tetap.
CREATE OR REPLACE FUNCTION "hris"."guard_notification_change"() RETURNS trigger LANGUAGE plpgsql AS $$
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
     OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at)
     OR (OLD.popup_acked_at IS NOT NULL AND NEW.popup_acked_at IS DISTINCT FROM OLD.popup_acked_at)
     OR (NEW.read_at IS NOT DISTINCT FROM OLD.read_at AND NEW.popup_acked_at IS NOT DISTINCT FROM OLD.popup_acked_at) THEN
    RAISE EXCEPTION 'Pemberitahuan hanya bisa ditandai terbaca.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
