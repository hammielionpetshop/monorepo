import { trainingDueOn, type IsoDate, type TrainingMonthsVersion } from './dates';

// Antrean Promosi Training (KAR-20, 21, 23). Dihitung saat layar dibuka, tanpa mesin jadwal (spec L2c §7.6).

export type TrainingReviewRecord = {
  id: number;
  decision: 'APPROVE' | 'DEFER';
  reviewAgainOn: IsoDate | null;
};

/**
 * Masuk antrean bila hari ini Training, aktif, sudah genap 3 bulan, belum disetujui, dan tanggal
 * "nilai lagi" dari penundaan terakhir (bila ada) sudah tiba. Mengembalikan tanggal jatuh temponya.
 */
export function promotionDueOn(input: {
  joinedOn: IsoDate;
  workStatusToday: 'TRAINING' | 'EMPLOYEE' | null;
  activeToday: boolean;
  reviews: readonly TrainingReviewRecord[];
  today: IsoDate;
  trainingMonths?: readonly TrainingMonthsVersion[];
}): IsoDate | null {
  if (input.workStatusToday !== 'TRAINING' || !input.activeToday) return null;
  const last = [...input.reviews].sort((a, b) => b.id - a.id)[0];
  if (last?.decision === 'APPROVE') return null;
  const due = last?.decision === 'DEFER' && last.reviewAgainOn ? last.reviewAgainOn : trainingDueOn(input.joinedOn, input.trainingMonths);
  return due <= input.today ? due : null;
}
