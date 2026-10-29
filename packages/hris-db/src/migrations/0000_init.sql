CREATE SCHEMA "hris";
--> statement-breakpoint
CREATE TYPE "hris"."job_run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TABLE "hris"."job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "hris"."job_run_status" DEFAULT 'RUNNING' NOT NULL,
	"summary" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "job_runs_name_started_idx" ON "hris"."job_runs" USING btree ("name","started_at");