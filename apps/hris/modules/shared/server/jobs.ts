import { eq } from 'drizzle-orm';
import { jobRuns } from '@petshop/hris-db/schema/shared';
import { db } from '@/lib/db';

// Pekerjaan harus aman diulang; catatan eksekusi tetap dibuat untuk setiap panggilan.
// Pekerjaan milik modul lain didaftarkan dengan impor dinamis supaya modul `shared` tidak bergantung padanya saat dimuat.
export const jobs = new Map<string, () => Promise<Record<string, unknown>>>([
  ['heartbeat', async () => ({ timestamp: new Date().toISOString() })],
  // 00.01 WIB: nonaktif/aktif lagi bertanggal depan diikuti akun pusat (spec L2c §5).
  ['employee-status-apply', async () => (await import('@/modules/employees')).applyDueEmploymentStatus((await import('@/modules/payroll')).hasMoneyMatters)],
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
  // 00.20 WIB: tahun cuti hangus/buka, surat dokter tinggal 1 hari, menunggu di hari H, sisa cuti mau hangus (spec L3f §6).
  ['absence-daily', async () => (await import('@/modules/attendance')).runAbsenceDaily()],
  // 04.20 WIB: kejadian Perlu Dijelaskan dan alpha hari kemarin, lewat batas, pengingat, tidak masuk berturut-turut (spec L3g §6).
  ['clarification-daily', async () => (await import('@/modules/attendance')).runClarificationDaily()],
  ['overtime-daily', async () => (await import('@/modules/attendance')).runOvertimeDaily()],
  // 04.40 WIB: usulan ubah gaji lewat batas menjadi Hangus (spec L4a §6).
  ['salary-proposal-expire', async () => (await import('@/modules/payroll')).runSalaryProposalExpire()],
  // 04.50 WIB: salin minus kas shift POS terverifikasi, lalu usulan per orang untuk periode yang lewat (spec L4c §6).
  ['cash-shortage-sync', async () => (await import('@/modules/payroll')).runCashShortageSync()],
  // 04.45 WIB: samakan Buku Bonus dengan jasa grooming dan ongkir kasir (spec L4d §3.2, §6).
  ['bonus-sync', async () => (await import('@/modules/payroll')).runBonusSync()],
  // 04.55 WIB: kerangka slip periode berjalan dan periode lalu (spec L4e §6).
  ['payslip-skeleton', async () => (await import('@/modules/payroll')).runPayslipSkeleton()],
  // 07.00 WIB mulai batas tutup: pengingat slip yang belum ditutup (spec L4e §6).
  ['payslip-reminder', async () => (await import('@/modules/payroll')).runPayslipReminder()],
  // 07.00 WIB: pengingat slip yang lewat jatuh bayar dan belum ditandai Dibayar (spec L4f §6).
  ['payslip-pay-reminder', async () => (await import('@/modules/payroll')).runPayslipPayReminder()],
  // 05.05 WIB: lahirkan tagihan bayar di luar slip yang belum ada (spec L4f §6).
  ['off-slip-claims', async () => (await import('@/modules/payroll')).runOffSlipClaims()],
  // 07.10 WIB: pengingat keberatan slip Menunggu dan "menunggu pembetulan" (spec L4g §6).
  ['payslip-objection-reminder', async () => (await import('@/modules/payroll')).runPayslipObjectionReminder()],
  // 07.00 WIB: pengingat kasbon disetujui belum diberikan, tanda Lewat 2 hari, pemeriksa sisa kasbon (spec L5 §6).
  ['advance-daily', async () => (await import('@/modules/advances')).runAdvanceDaily()],
  // 12.05 WIB: trip menggantung diberitahukan sekali, isi foto awak lewat masa simpan dibuang (spec L6 §6).
  ['logistics-daily', async () => (await import('@/modules/logistics')).runLogisticsDaily()],
  // Tiap 10 menit: nota yang sudah di trip berubah / dibatalkan di kasir diberitahukan sekali per keadaan (spec LT1 §14.3).
  ['logistics-kasir-check', async () => (await import('@/modules/logistics')).runKasirCheck()],
  // 04.40 WIB: nilai upah ritase yang terlewat, penilaian ulang status hari 14 hari ke belakang, pemeriksa (spec L7 §6).
  ['trip-wage-daily', async () => (await import('@/modules/payroll')).runTripWageDaily()],
  // 00.15 WIB tiap hari: kerangka slip mingguan minggu berjalan dan minggu lalu (spec L7 §6).
  ['payslip-weekly-skeleton', async () => (await import('@/modules/payroll')).runWeeklySkeleton()],
  // Tiap jam: pengingat slip mingguan belum ditutup (spec L7 §6).
  ['payslip-weekly-reminder', async () => (await import('@/modules/payroll')).runWeeklyReminder()],
  // 07.00 WIB: pengingat Laporan Bongkaran belum dibayar, lebih bayar lewat batas ditandai (spec L8 §6).
  ['unloading-daily', async () => (await import('@/modules/payroll')).runUnloadingDaily()],
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
