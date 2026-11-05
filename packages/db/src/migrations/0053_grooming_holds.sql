-- Grooming Ditahan (keputusan owner 2026-11-05, docs/work/specs/2026-11-05-grooming-tahan-design.md):
-- kucing diterima & karcis dicetak dulu, nota menyusul. Hanya menambah tabel; tabel lama tidak diubah.
CREATE TABLE IF NOT EXISTS "petshop"."grooming_holds" (
  "id" serial PRIMARY KEY NOT NULL,
  "branch_id" integer NOT NULL REFERENCES "petshop"."branches"("id"),
  "customer_id" integer NOT NULL REFERENCES "petshop"."customers"("id"),
  "lines" jsonb NOT NULL,
  "delivery" jsonb,
  "status" varchar(20) DEFAULT 'DITAHAN' NOT NULL,
  "ticket_print_count" integer DEFAULT 0 NOT NULL,
  "transaction_id" integer REFERENCES "petshop"."transactions"("id"),
  "held_by_id" integer REFERENCES "petshop"."users"("id"),
  "held_at" timestamp DEFAULT now() NOT NULL,
  "converted_at" timestamp,
  "cancelled_by_id" integer REFERENCES "petshop"."users"("id"),
  "cancelled_at" timestamp,
  "cancel_reason" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_grooming_holds_branch_status" ON "petshop"."grooming_holds" ("branch_id", "status", "held_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_grooming_holds_transaction" ON "petshop"."grooming_holds" ("transaction_id");
