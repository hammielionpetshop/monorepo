import { pgSchema, serial, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const hrisSchema = pgSchema('hris');

export const jobRunStatus = hrisSchema.enum('job_run_status', ['RUNNING', 'SUCCEEDED', 'FAILED']);

// Catatan tiap kali mesin terjadwal jalan. Tidak pernah dihapus.
export const jobRuns = hrisSchema.table(
  'job_runs',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: jobRunStatus('status').notNull().default('RUNNING'),
    summary: jsonb('summary'),
    error: text('error'),
  },
  (t) => [index('job_runs_name_started_idx').on(t.name, t.startedAt)],
);
