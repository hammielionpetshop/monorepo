import { eq } from 'drizzle-orm';
import { jobRuns } from '@petshop/hris-db/schema/shared';
import { db } from '@/lib/db';

// Pekerjaan harus aman diulang; catatan eksekusi tetap dibuat untuk setiap panggilan.
export const jobs = new Map<string, () => Promise<Record<string, unknown>>>([
  ['heartbeat', async () => ({ timestamp: new Date().toISOString() })],
]);

export async function runJob(name: string) {
  const job = jobs.get(name);
  if (!job) return null;

  const [run] = await db.insert(jobRuns).values({ name, status: 'RUNNING' }).returning({ id: jobRuns.id });
  let summary: Record<string, unknown>;
  try {
    summary = await job();
  } catch (error) {
    await db.update(jobRuns).set({
      status: 'FAILED',
      finishedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    }).where(eq(jobRuns.id, run.id));
    throw error;
  }

  await db.update(jobRuns).set({ status: 'SUCCEEDED', finishedAt: new Date(), summary }).where(eq(jobRuns.id, run.id));
  return { id: run.id, status: 'SUCCEEDED' as const, summary };
}
