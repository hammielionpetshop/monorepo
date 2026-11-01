import { eq } from 'drizzle-orm';
import { jobRuns } from '@petshop/hris-db/schema/shared';
import { db } from '@/lib/db';

// Pekerjaan harus aman diulang; catatan eksekusi tetap dibuat untuk setiap panggilan.
// Pekerjaan milik modul lain didaftarkan dengan impor dinamis supaya modul `shared` tidak bergantung padanya saat dimuat.
export const jobs = new Map<string, () => Promise<Record<string, unknown>>>([
  ['heartbeat', async () => ({ timestamp: new Date().toISOString() })],
  // 00.01 WIB: nonaktif/aktif lagi bertanggal depan diikuti akun pusat (spec L2c §5).
  ['employee-status-apply', async () => (await import('@/modules/employees')).applyDueEmploymentStatus()],
  // 00.20 WIB: buang pemberitahuan lebih dari 90 hari (BER-L02, spec L2f-1 §2.6).
  ['notifications-purge', async () => (await import('@/modules/notifications')).purgeOldNotifications()],
  // 00.25 WIB: buang catatan jeda dan tiket lupa password yang 30 hari diam (spec L2f-2 §4.4).
  ['recovery-purge', async () => (await import('@/modules/accounts')).purgeRecovery()],
  // 00.05 WIB tiap hari: isi jadwal minggu berjalan; yang terlewat dikejar (spec L3a §6).
  ['shift-rotate', async () => (await import('@/modules/attendance')).rotateShifts()],
  // 06.00 WIB: kelompok kosong atau orang tanpa shift (spec L3a §6).
  ['shift-check', async () => (await import('@/modules/attendance')).checkShifts()],
  // 02.00 WIB: buang isi foto absen lewat masa simpan (spec L3b §6).
  ['attendance-photo-purge', async () => (await import('@/modules/attendance')).purgeAttendancePhotos()],
  // 05.00 WIB: tanda pola lokasi mencurigakan untuk hari yang sudah lewat (spec L3c §6).
  ['attendance-pattern-scan', async () => (await import('@/modules/attendance')).scanAttendancePatterns()],
  // 00.10 WIB: ajakan tukar lewat batas, tanda tidak memilih libur, pengganti hangus, pengingat (spec L3e §6).
  ['days-off-daily', async () => (await import('@/modules/attendance')).runDaysOffDaily()],
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
