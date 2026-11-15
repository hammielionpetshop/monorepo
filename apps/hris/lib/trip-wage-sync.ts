import { syncTripWages } from '@/modules/payroll';

/**
 * Nilai upah ritase sesudah tindakan Logistik berhasil (spec L7 §3.2). Gagal di sini tidak menggagalkan tindakan
 * trip-nya: mesin harian `trip-wage-daily` menilai ulang yang terlewat.
 */
export async function valueTripWagesAfter(filter: Parameters<typeof syncTripWages>[0], actorAccountId: number | null) {
  try {
    await syncTripWages(filter, actorAccountId);
  } catch (error) {
    console.error('Gagal menilai upah ritase; menunggu mesin harian.', error);
  }
}
