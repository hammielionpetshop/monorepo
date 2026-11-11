import { reasonProblem, type IsoDate } from './trip';

// Sewa Mobil per Ritase (F2-5b, spec F2-5 §3.2–3.3). Fungsi murni, dipakai server Logistik dan tes.

export type Ownership = 'OWNED' | 'RENTED';
export const OWNERSHIP_LABELS: Record<Ownership, string> = { OWNED: 'Milik sendiri', RENTED: 'Sewa' };

export type RentalRateRecord = { id: number; vehicleId: number; effectiveFrom: IsoDate; amount: number; status: string };
export type RentalPaymentKind = 'PAYMENT' | 'TOP_UP';
export const PAYMENT_KIND_LABELS: Record<RentalPaymentKind, string> = { PAYMENT: 'Bayar', TOP_UP: 'Bayar susulan' };

export const RENTAL_RATE_MAX = 50_000_000;
export const RENTAL_PAY_MAX = 1_000_000_000;

/** Bulan rekap `YYYY-MM` → hari pertama dan terakhir. */
export function monthRange(month: string): { from: IsoDate; to: IsoDate } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}` };
}

export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Sewa hanya dibayar untuk bulan yang sudah lewat (sewa Oktober dibayar mulai 1 November). */
export function monthPayable(month: string, today: IsoDate): boolean {
  return month < monthOf(today);
}

/** Tarif sewa mobil pada tanggal T: baris ACTIVE dengan berlaku dari ≤ T yang paling akhir. */
export function rentalRateOn<T extends RentalRateRecord>(rows: readonly T[], vehicleId: number, date: IsoDate): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (row.status !== 'ACTIVE' || row.vehicleId !== vehicleId || row.effectiveFrom > date) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  return best;
}

/** Trip mobil di bulan itu (semua status; yang dihitung hanya DONE). */
export type TripInput = { id: number; number: string; tripDate: IsoDate; status: string };
/** Ritase tangan (trip_wages MANUAL) mobil itu. */
export type ManualInput = { id: number; tripDate: IsoDate; role: string; kind: string; cancelled: boolean };

export type RentalLine = {
  date: IsoDate;
  /** Nomor trip, atau null untuk ritase tangan. */
  tripId: number | null;
  tripNumber: string | null;
  manualId: number | null;
  rate: number | null;
  amount: number;
};

export type RentalRecap = { lines: RentalLine[]; tripCount: number; total: number; unratedDates: IsoDate[] };

/**
 * 1 ritase sewa = 1 trip Selesai mobil itu (banyak orang/belanja tidak menambah); ritase tangan dihitung 1 bila Driver,
 * jenis Ritase, tidak batal. Rupiah = tarif pada tanggal trip; tanggal tanpa tarif = belum bertarif.
 */
export function rentalRecap(input: {
  vehicleId: number; trips: readonly TripInput[]; manual: readonly ManualInput[]; rates: readonly RentalRateRecord[];
}): RentalRecap {
  const counted: Omit<RentalLine, 'rate' | 'amount'>[] = [
    ...input.trips.filter((t) => t.status === 'DONE').map((t) => ({ date: t.tripDate, tripId: t.id, tripNumber: t.number, manualId: null })),
    ...input.manual.filter((w) => !w.cancelled && w.role === 'DRIVER' && w.kind === 'RITASE')
      .map((w) => ({ date: w.tripDate, tripId: null, tripNumber: null, manualId: w.id })),
  ].sort((a, b) => (a.date === b.date ? (a.tripNumber ?? '~').localeCompare(b.tripNumber ?? '~') : a.date < b.date ? -1 : 1));
  const unrated = new Set<IsoDate>();
  let total = 0;
  const lines = counted.map((line) => {
    const rate = rentalRateOn(input.rates, input.vehicleId, line.date);
    if (!rate) unrated.add(line.date);
    const amount = rate?.amount ?? 0;
    total += amount;
    return { ...line, rate: rate?.amount ?? null, amount };
  });
  return { lines, tripCount: lines.length, total, unratedDates: [...unrated].sort() };
}

export type PaymentRecord = { id: number; kind: RentalPaymentKind; amount: number; billedAmount: number; paidAt: Date; cancelled: boolean };

export type PaymentState = {
  paid: number;
  remaining: number;
  /** Rekap sekarang − potret pembayaran terakhir; null bila belum ada pembayaran berlaku. */
  changeAfterPaid: number | null;
  hasPayment: boolean;
  /** Jumlah bawaan untuk tombol Bayar / Bayar susulan, atau null bila tombol tidak tampil. */
  next: { kind: RentalPaymentKind; due: number } | null;
};

/**
 * Keadaan bayar satu mobil satu bulan. Bayar pertama = total rekap; sesudah itu perubahan rekap dibandingkan dengan
 * potret pembayaran terakhir: bertambah → Bayar susulan sebesar selisihnya; berkurang → catatan lebih bayar (tidak otomatis).
 */
export function paymentState(total: number, payments: readonly PaymentRecord[]): PaymentState {
  const live = payments.filter((p) => !p.cancelled).sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.id - b.id);
  const paid = live.reduce((sum, p) => sum + p.amount, 0);
  const hasPayment = live.some((p) => p.kind === 'PAYMENT');
  const last = live[live.length - 1];
  const changeAfterPaid = hasPayment && last ? total - last.billedAmount : null;
  let next: PaymentState['next'] = null;
  if (!hasPayment) next = total > 0 ? { kind: 'PAYMENT', due: total } : null;
  else if (changeAfterPaid != null && changeAfterPaid > 0) next = { kind: 'TOP_UP', due: changeAfterPaid };
  return { paid, remaining: total - paid, changeAfterPaid, hasPayment, next };
}

/** Pemeriksaan isian Bayar / Bayar susulan (selain hak dan Tempat Uang). */
export function payProblem(input: {
  month: string; today: IsoDate; occurredOn: string; amount: number; differenceReason: string | null; unratedDates: readonly IsoDate[];
  next: PaymentState['next']; kind: RentalPaymentKind;
}): string | null {
  if (!monthPayable(input.month, input.today)) return `Sewa ${monthLabel(input.month)} baru bisa dibayar mulai 1 ${monthLabel(nextMonth(input.month))}.`;
  if (input.unratedDates.length) return 'Masih ada ritase belum bertarif. Isi tarif sewa mobil ini dulu di Mobil & Rute.';
  if (!input.next || input.next.kind !== input.kind) {
    return input.kind === 'PAYMENT' ? 'Sewa bulan ini sudah dibayar. Muat ulang halaman.' : 'Tidak ada kekurangan untuk dibayar susulan. Muat ulang halaman.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return 'Isi tanggal uang.';
  if (input.occurredOn > input.today) return 'Tanggal uang tidak boleh sesudah hari ini.';
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Jumlah dibayar harus rupiah bulat lebih dari Rp0.';
  if (input.amount > RENTAL_PAY_MAX) return 'Jumlah dibayar terlalu besar.';
  if (input.amount !== input.next.due) {
    const problem = reasonProblem(input.differenceReason);
    if (problem) return `Jumlah beda dengan tagihan: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`;
  }
  return null;
}

/** Batal pembayaran: pembayar sendiri di hari yang sama (WIB), sesudahnya Pemilik/GM. */
export function canCancelPayment(input: { paidByAccountId: number; paidOn: IsoDate; actorAccountId: number; ownerOrGm: boolean; today: IsoDate }): boolean {
  return input.ownerOrGm || (input.paidByAccountId === input.actorAccountId && input.paidOn === input.today);
}

export function rentalRateProblem(amount: number): string | null {
  if (!Number.isInteger(amount) || amount < 0) return 'Tarif sewa per ritase: isi rupiah bulat, tidak boleh minus.';
  if (amount > RENTAL_RATE_MAX) return 'Tarif sewa per ritase terlalu besar.';
  return null;
}
