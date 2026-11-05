-- Logistik LT2c: nota berubah / dibatalkan di kasir sesudah masuk trip (spec docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §14.3).
CREATE TABLE "logistics"."kasir_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"kind" text NOT NULL,
	"signature" text NOT NULL,
	"from_amount" integer,
	"to_amount" integer,
	"revision" integer,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kept_at" timestamp with time zone,
	"kept_by_account_id" integer,
	"cleared_at" timestamp with time zone,
	CONSTRAINT "kasir_changes_kind" CHECK ("logistics"."kasir_changes"."kind" in ('CHANGED', 'PENDING_CANCEL', 'CANCELLED')),
	CONSTRAINT "kasir_changes_kept" CHECK (("logistics"."kasir_changes"."kept_at" is null) = ("logistics"."kasir_changes"."kept_by_account_id" is null) and ("logistics"."kasir_changes"."kept_at" is null or "logistics"."kasir_changes"."kind" <> 'CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" DROP CONSTRAINT "delivery_note_events_kind";--> statement-breakpoint
ALTER TABLE "logistics"."kasir_changes" ADD CONSTRAINT "kasir_changes_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "logistics"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics"."kasir_changes" ADD CONSTRAINT "kasir_changes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "logistics"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kasir_changes_once" ON "logistics"."kasir_changes" USING btree ("note_id","trip_id","signature");--> statement-breakpoint
CREATE INDEX "kasir_changes_open_idx" ON "logistics"."kasir_changes" USING btree ("trip_id") WHERE "logistics"."kasir_changes"."kept_at" is null and "logistics"."kasir_changes"."cleared_at" is null;--> statement-breakpoint
ALTER TABLE "logistics"."delivery_note_events" ADD CONSTRAINT "delivery_note_events_kind" CHECK ("logistics"."delivery_note_events"."kind" in ('ON_TRIP', 'RELEASED', 'TRIP_CANCELLED', 'TRIP_CLOSED', 'LOADED', 'NOT_READY', 'DELIVERED', 'TOMORROW', 'FAILED', 'RETRY', 'RESENT', 'DROPPED', 'REOPENED', 'PENDING_CLOSED', 'KASIR_CHANGED', 'KASIR_KEPT'));--> statement-breakpoint
CREATE TRIGGER kasir_changes_no_delete BEFORE DELETE ON logistics.kasir_changes FOR EACH ROW EXECUTE FUNCTION logistics.forbid_delete();
