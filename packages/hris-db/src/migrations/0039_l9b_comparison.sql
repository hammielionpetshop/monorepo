CREATE TABLE "hris"."comparison_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"table_name" text NOT NULL,
	"row_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comparison_rows_table" CHECK ("hris"."comparison_rows"."table_name" ~ '^(hris|logistics)\.[a-z_]+$')
);
--> statement-breakpoint
CREATE TABLE "hris"."comparison_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_start" date NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'LOADED' NOT NULL,
	"source_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_count" integer DEFAULT 0 NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purged_at" timestamp with time zone,
	CONSTRAINT "comparison_runs_period_day" CHECK (extract(day from "hris"."comparison_runs"."period_start") = 26),
	CONSTRAINT "comparison_runs_status" CHECK ("hris"."comparison_runs"."status" in ('LOADED', 'PURGED')),
	CONSTRAINT "comparison_runs_computed" CHECK ("hris"."comparison_runs"."computed_count" between 0 and 2),
	CONSTRAINT "comparison_runs_purged" CHECK (("hris"."comparison_runs"."status" = 'PURGED') = ("hris"."comparison_runs"."purged_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "hris"."comparison_slips" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"legacy_code" text NOT NULL,
	"slip_kind" text NOT NULL,
	"slip_start" date NOT NULL,
	"old_total" integer NOT NULL,
	"old_components" jsonb NOT NULL,
	"first_total" integer,
	"first_components" jsonb,
	"second_total" integer,
	"second_components" jsonb,
	"cause" text,
	"rule_ref" text,
	"note" text,
	"decided_by_account_id" integer,
	"decided_at" timestamp with time zone,
	CONSTRAINT "comparison_slips_kind" CHECK ("hris"."comparison_slips"."slip_kind" in ('MONTHLY', 'WEEKLY', 'WEEKLY_EXTRA')),
	CONSTRAINT "comparison_slips_cause" CHECK ("hris"."comparison_slips"."cause" is null or "hris"."comparison_slips"."cause" in ('INTENDED', 'FIX')),
	CONSTRAINT "comparison_slips_rule" CHECK ("hris"."comparison_slips"."cause" is distinct from 'INTENDED' or ("hris"."comparison_slips"."rule_ref" is not null and btrim("hris"."comparison_slips"."rule_ref") <> '')),
	CONSTRAINT "comparison_slips_decided" CHECK (("hris"."comparison_slips"."cause" is null) = ("hris"."comparison_slips"."decided_at" is null))
);
--> statement-breakpoint
ALTER TABLE "hris"."comparison_rows" ADD CONSTRAINT "comparison_rows_run_id_comparison_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "hris"."comparison_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."comparison_slips" ADD CONSTRAINT "comparison_slips_run_id_comparison_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "hris"."comparison_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris"."comparison_slips" ADD CONSTRAINT "comparison_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "hris"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_rows_unique" ON "hris"."comparison_rows" USING btree ("table_name","row_id");--> statement-breakpoint
CREATE INDEX "comparison_rows_run_idx" ON "hris"."comparison_rows" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_slips_unique" ON "hris"."comparison_slips" USING btree ("run_id","employee_id","slip_kind","slip_start");--> statement-breakpoint
CREATE INDEX "comparison_slips_run_idx" ON "hris"."comparison_slips" USING btree ("run_id");