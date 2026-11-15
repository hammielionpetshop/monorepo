// Menilai ritase dan upah belanja menjadi rupiah (spec L7 §3.2; DRV-09, 10, 11, 16, 17; U5). Fungsi murni.

export type CrewRole = 'DRIVER' | 'ASSISTANT';
export type PayBasis = 'MONTHLY' | 'WEEKLY';
export type ZeroReason = 'WORKDAY' | 'NOT_DAY_OFF' | 'NO_ASSISTANT_PAY';
export type DayStatusValue = 'PRESENT' | 'CLOSED' | 'DAY_OFF' | 'PERMIT' | 'SICK' | 'LEAVE' | 'ALPHA' | 'UNDETERMINED';
export type Numbers = { driverWithAssistant: number; driverAlone: number; assistant: number };

export const ZERO_REASON_LABELS: Record<ZeroReason, string> = {
  WORKDAY: 'Hari kerja, sudah dibayar gaji',
  NOT_DAY_OFF: 'Bukan hari libur',
  NO_ASSISTANT_PAY: 'Rute tanpa upah kenek',
};

export const WAGE_VALUE_STATUS_LABELS = { ACTIVE: 'Berlaku', UNRATED: 'Belum bertarif', CANCELLED: 'Dibatalkan' } as const;

export type WageValue = {
  status: 'ACTIVE' | 'UNRATED';
  rateId: number | null;
  rateAmount: number | null;
  amount: number;
  payBasis: PayBasis;
  dayStatus: DayStatusValue | null;
  zeroReason: ZeroReason | null;
  needsLook: boolean;
};

/** Libur terjadwal (termasuk libur pengganti) dan hari tutup cabang = hari libur orang bulanan (DRV-16). */
const DAY_OFF: readonly DayStatusValue[] = ['DAY_OFF', 'CLOSED'];

export function rateAmountFor(rate: Numbers, role: CrewRole, withAssistant: boolean): number {
  if (role === 'ASSISTANT') return rate.assistant;
  return withAssistant ? rate.driverWithAssistant : rate.driverAlone;
}

/**
 * Langkah 3-5 spec §3.2. Orang bulanan: hari libur/tutup → tarif penuh; hari kerja (hadir, atau jabatan tak diabsen = null)
 * → Rp0; izin/sakit/cuti/alpha/belum ditentukan → Rp0 + Perlu dilihat. Orang mingguan: tarif penuh tanpa melihat hari.
 * Dua sebab Rp0 → sebab hari yang ditulis. Tanpa tarif → Belum bertarif (Rp0).
 */
export function valueWage(input: {
  role: CrewRole; withAssistant: boolean; rate: (Numbers & { id: number }) | null; payBasis: PayBasis; dayStatus: DayStatusValue | null;
}): WageValue {
  const dayStatus = input.payBasis === 'MONTHLY' ? input.dayStatus : null;
  if (!input.rate) {
    return { status: 'UNRATED', rateId: null, rateAmount: null, amount: 0, payBasis: input.payBasis, dayStatus, zeroReason: null, needsLook: false };
  }
  const rateAmount = rateAmountFor(input.rate, input.role, input.withAssistant);
  let zeroReason: ZeroReason | null = null;
  let needsLook = false;
  if (input.payBasis === 'MONTHLY' && !(dayStatus && DAY_OFF.includes(dayStatus))) {
    if (dayStatus == null || dayStatus === 'PRESENT') zeroReason = 'WORKDAY';
    else {
      zeroReason = 'NOT_DAY_OFF';
      needsLook = true;
    }
  }
  if (!zeroReason && rateAmount === 0) zeroReason = 'NO_ASSISTANT_PAY';
  return {
    status: 'ACTIVE', rateId: input.rate.id, rateAmount, amount: zeroReason ? 0 : rateAmount, payBasis: input.payBasis, dayStatus, zeroReason, needsLook,
  };
}

export function sameValue(a: WageValue, b: WageValue): boolean {
  return a.status === b.status && a.rateId === b.rateId && a.rateAmount === b.rateAmount && a.amount === b.amount && a.payBasis === b.payBasis
    && a.dayStatus === b.dayStatus && a.zeroReason === b.zeroReason && a.needsLook === b.needsLook;
}

/** Sebab penilaian ulang dalam kalimat untuk orangnya (spec §3.3). */
export function revalueCause(before: WageValue, after: WageValue, dayLabel: (s: DayStatusValue) => string): string {
  if (before.status === 'UNRATED' && after.status === 'ACTIVE') return 'tarif pasangan ini sudah diisi';
  if (before.rateId !== after.rateId || before.rateAmount !== after.rateAmount) return 'tarif dibetulkan';
  if (before.payBasis !== after.payBasis) return 'dasar gaji jabatan berubah';
  if (before.dayStatus !== after.dayStatus) return `status hari itu menjadi ${after.dayStatus ? dayLabel(after.dayStatus).toLowerCase() : 'hari kerja'}`;
  return 'data pendukung berubah';
}

/** Kalimat keterangan Rp0 / belum bertarif untuk tampilan. */
export function valueNote(v: Pick<WageValue, 'status' | 'zeroReason'>): string | null {
  if (v.status === 'UNRATED') return 'Belum bertarif';
  return v.zeroReason ? ZERO_REASON_LABELS[v.zeroReason] : null;
}

/** Minggu upah Jumat–Kamis (DRV-19). */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 2) % 7));
  return d.toISOString().slice(0, 10);
}

/** Enam jenis upah isi awal DRV-02 (U1: baca saja; jenis baru lewat pembangunan sistem). */
export const WAGE_KINDS = [
  { code: 'base_salary', name: 'Gaji tetap', unit: 'bulan', source: 'Paket gaji per orang', module: 'Gaji', track: 'Slip bulanan' },
  { code: 'overtime', name: 'Lembur dan kompensasi libur', unit: 'jam / hari', source: 'Aturan potongan & lembur', module: 'Kehadiran', track: 'Slip bulanan' },
  { code: 'bonus', name: 'Bonus', unit: 'kejadian', source: 'Jenis bonus', module: 'Gaji', track: 'Slip utama' },
  { code: 'ritase', name: 'Ritase driver dan kenek', unit: 'trip', source: 'Tarif Ritase per mobil dan rute', module: 'Logistik', track: 'Slip mingguan' },
  { code: 'shopping', name: 'Upah belanja', unit: 'supplier per trip', source: 'Tarif Ritase rute belanja', module: 'Logistik', track: 'Slip mingguan' },
  { code: 'unloading', name: 'Bongkaran', unit: 'kg', source: 'Tarif bongkaran per kg', module: 'Gudang (menyusul L8)', track: 'Tunai hari itu' },
] as const;
