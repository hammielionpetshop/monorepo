// Aturan murni kasbon (spec L5 §3; DRV-55 s.d. 67, 121 s.d. 133). Tanpa basis data; dites per nomor aturan.

export type IsoDate = string;

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function longDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function rupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;
}

/** Awal periode slip bulanan (26–25) yang memuat tanggal ini. Sama dengan rumus Gaji (GAJ-02). */
export function periodStartOf(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, d >= 26 ? m - 1 : m - 2, 26)).toISOString().slice(0, 10);
}

export function addPeriods(start: IsoDate, count: number): IsoDate {
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + count, 26)).toISOString().slice(0, 10);
}

export function periodEndOf(start: IsoDate): IsoDate {
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m, 25)).toISOString().slice(0, 10);
}

export const periodLabel = (start: IsoDate) => `${longDate(start)} – ${longDate(periodEndOf(start))}`;

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Tanggal + n bulan kalender; tanggal yang tidak ada di bulan itu memakai hari terakhir bulan itu (DRV-121). */
export function addMonthsClamped(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

export function advanceNumber(sequence: number): string {
  return `KB-${String(sequence).padStart(4, '0')}`;
}

export type AdvanceRules = {
  minTenureMonths: number;
  personLimit: number;
  fundSize: number;
  maxInstallments: number;
  reasonMin: number;
  amountStep: number;
  amountMin: number;
};

/** Nominal kasbon: rupiah bulat, kelipatan dan paling sedikit menurut pengaturan (DRV-122, K1). Batas atas tidak disebut. */
export function amountProblem(amount: number, rules: Pick<AdvanceRules, 'amountStep' | 'amountMin'>): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return 'Nominal harus rupiah bulat lebih dari 0.';
  if (amount < rules.amountMin) return `Kasbon paling sedikit ${rupiah(rules.amountMin)}.`;
  if (amount % rules.amountStep !== 0) return `Nominal harus kelipatan ${rupiah(rules.amountStep)}.`;
  return null;
}

export function installmentsProblem(count: number, max: number): string | null {
  if (!Number.isInteger(count) || count < 1 || count > max) return `Kali potong 1 sampai ${max}.`;
  return null;
}

/** Nominal dibagi rata, dibulatkan ke bawah ke rupiah, sisanya di cicilan terakhir (DRV-65, 125). */
export function splitInstallments(amount: number, count: number): number[] {
  const each = Math.floor(amount / count);
  return Array.from({ length: count }, (_, index) => (index === count - 1 ? amount - each * (count - 1) : each));
}

export const MSG_TENURE = 'Kasbon baru bisa diajukan setelah 6 bulan bekerja. Kalau mendesak, hubungi GM.';
export const MSG_PERSON = 'Pastikan Anda sudah membayar kasbon lama. Ditolak karena kasbon lama masih banyak.';
export const MSG_FUND = 'Kasbon belum bisa diajukan saat ini. Silakan coba lagi setelah gajian.';
export const MSG_WEEKLY = 'Kasbon untuk driver dan kenek dibuka bersamaan dengan slip mingguan. Kalau mendesak, hubungi GM.';
export const MSG_NO_SLIP = 'Kasbon hanya untuk karyawan yang menerima slip gaji.';
export const MSG_LEAVING = 'Kasbon tidak bisa diajukan karena tanggal berhenti Anda sudah tercatat. Kalau mendesak, hubungi GM.';
export const MSG_INACTIVE = 'Kasbon hanya untuk karyawan aktif.';
export const MSG_PENDING = 'Masih ada pengajuan kasbon yang menunggu. Batalkan dulu kalau ingin mengubahnya.';

/** Kalimat masa kerja memakai angka pengaturan (isi awal 6 bulan = kalimat v3 apa adanya). */
export const tenureMessage = (months: number) => (months === 6 ? MSG_TENURE : `Kasbon baru bisa diajukan setelah ${months} bulan bekerja. Kalau mendesak, hubungi GM.`);

export type CheckFacts = {
  active: boolean;
  /** Dasar gaji jabatan hari ini; WEEKLY belum bisa sampai slip mingguan ada (spec L5 §9 butir 2). */
  payBasis: 'MONTHLY' | 'WEEKLY' | null;
  hasPackage: boolean;
  /** Tanggal berhenti sudah tercatat (DRV-139). */
  leaving: boolean;
  joinedOn: IsoDate;
  today: IsoDate;
  /** Terpakai orang itu dan seluruh dana (kasbon biasa + bawaan, tanpa Kasbon Khusus). */
  personUsed: number;
  fundUsed: number;
  /** Punya kasbon biasa bersisa atau pengajuan menunggu: kalimat penolakan batas orang (DRV-56). */
  hasRunningOrPending: boolean;
  hasPending: boolean;
  amount: number;
};

export type CheckResult = { ok: true } | { ok: false; step: 'ELIGIBLE' | 'TENURE' | 'PENDING' | 'PERSON' | 'FUND'; message: string };

/** "Periksa kasbon" (DRV-58, 121): urutan tetap; gagal di satu langkah = langkah berikutnya tidak diperiksa. */
export function checkAdvanceFacts(facts: CheckFacts, rules: AdvanceRules): CheckResult {
  if (!facts.active) return { ok: false, step: 'ELIGIBLE', message: MSG_INACTIVE };
  if (facts.payBasis === 'WEEKLY') return { ok: false, step: 'ELIGIBLE', message: MSG_WEEKLY };
  if (facts.payBasis !== 'MONTHLY' || !facts.hasPackage) return { ok: false, step: 'ELIGIBLE', message: MSG_NO_SLIP };
  if (facts.leaving) return { ok: false, step: 'ELIGIBLE', message: MSG_LEAVING };
  if (facts.today < addMonthsClamped(facts.joinedOn, rules.minTenureMonths)) return { ok: false, step: 'TENURE', message: tenureMessage(rules.minTenureMonths) };
  if (facts.hasPending) return { ok: false, step: 'PENDING', message: MSG_PENDING };
  if (facts.personUsed + facts.amount > rules.personLimit) {
    return { ok: false, step: 'PERSON', message: facts.hasRunningOrPending ? MSG_PERSON : MSG_FUND };
  }
  if (facts.fundUsed + facts.amount > rules.fundSize) return { ok: false, step: 'FUND', message: MSG_FUND };
  return { ok: true };
}

/** Keadaan kasbon yang tampil (spec 4G-4a "Perjalanan satu kasbon" + 4G-4b "Keadaan sesudah diberikan"). */
export type AdvanceStage = 'WAITING_REVIEW' | 'REVIEWED' | 'REJECTED' | 'WITHDRAWN' | 'APPROVED' | 'CANCELLED' | 'RUNNING' | 'PAID_OFF' | 'TRANSFERRED';

export const STAGE_LABELS: Record<AdvanceStage, string> = {
  WAITING_REVIEW: 'Menunggu',
  REVIEWED: 'Diperiksa',
  REJECTED: 'Ditolak',
  WITHDRAWN: 'Dibatalkan (ditarik)',
  APPROVED: 'Disetujui, belum diberikan',
  CANCELLED: 'Dibatalkan',
  RUNNING: 'Berjalan',
  PAID_OFF: 'Lunas',
  TRANSFERRED: 'Dialihkan ke Piutang Lain',
};

export const STAGE_TONES: Record<AdvanceStage, 'info' | 'ok' | 'warn' | 'danger'> = {
  WAITING_REVIEW: 'warn', REVIEWED: 'warn', REJECTED: 'danger', WITHDRAWN: 'info', APPROVED: 'warn', CANCELLED: 'info',
  RUNNING: 'info', PAID_OFF: 'ok', TRANSFERRED: 'danger',
};

export function stageOf(input: {
  state: string; requestStatus: string | null; handedOver: boolean; remaining: number; transferred: boolean;
}): AdvanceStage {
  if (input.handedOver) {
    if (input.remaining > 0) return 'RUNNING';
    return input.transferred ? 'TRANSFERRED' : 'PAID_OFF';
  }
  if (input.state === 'OPEN') return input.requestStatus === 'REVIEWED' ? 'REVIEWED' : 'WAITING_REVIEW';
  if (input.state === 'REJECTED') return 'REJECTED';
  if (input.state === 'WITHDRAWN') return 'WITHDRAWN';
  if (input.state === 'CANCELLED') return 'CANCELLED';
  return 'APPROVED';
}

/** Yang dihitung "terpakai" per kasbon (DRV-121): Kasbon Khusus tidak; batal/tolak/lunas Rp0. */
export function usedOf(input: { kind: string; state: string; requestedAmount: number; finalAmount: number | null; handedOver: boolean; remaining: number }): number {
  if (input.kind === 'SPECIAL') return 0;
  if (input.handedOver) return Math.max(0, input.remaining);
  if (input.state === 'OPEN') return input.requestedAmount;
  if (input.state === 'APPROVED') return input.finalAmount ?? 0;
  return 0;
}

/** Sisa = nominal diberikan − catatan berkurang ACTIVE (DRV-67, 131). */
export function remainingOf(handedAmount: number, movements: readonly { amount: number; status: string }[]): number {
  return handedAmount - movements.filter((m) => m.status === 'ACTIVE').reduce((sum, m) => sum + m.amount, 0);
}

export const MONEY_DATE_FREE_DAYS = 7;

/**
 * Tanggal uang serah kasbon (DRV-126, K4; spec L5 §9 butir 5): tidak masa depan; mundur lebih dari 7 hari wajib alasan;
 * sebelum tanggal disetujui boleh dengan alasan wajib dan bertanda.
 */
export function handoverDateProblem(input: { moneyDate: string; today: IsoDate; approvedOn: IsoDate; reason: string | null }): string | null {
  const { moneyDate, today, approvedOn } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moneyDate) || Number.isNaN(Date.parse(`${moneyDate}T00:00:00Z`))) return 'Tanggal uang tidak sah.';
  if (moneyDate > today) return 'Tanggal uang tidak boleh sesudah hari ini.';
  const reasonOk = (input.reason ?? '').trim().length >= 15;
  if (moneyDate < approvedOn && !reasonOk) return 'Tanggal uang sebelum kasbon disetujui: tulis alasannya, paling sedikit 15 huruf.';
  if (daysBetween(moneyDate, today) > MONEY_DATE_FREE_DAYS && !reasonOk) return `Tanggal uang lebih dari ${MONEY_DATE_FREE_DAYS} hari lalu: tulis alasannya, paling sedikit 15 huruf.`;
  return null;
}

/**
 * Pasang jadwal (DRV-65, 132): cicilan pertama di periode yang memuat tanggal uang; bila slip orang itu di periode itu
 * sudah Ditutup, periode berikutnya yang belum ditutup; lalu satu per periode berturut-turut (melewati yang ditutup).
 */
export function placeSchedule(amounts: readonly number[], moneyDate: IsoDate, closed: ReadonlySet<IsoDate>, lastPeriod: IsoDate | null = null): IsoDate[] {
  const out: IsoDate[] = [];
  let period = periodStartOf(moneyDate);
  for (let i = 0; i < amounts.length; i += 1) {
    while (closed.has(period)) period = addPeriods(period, 1);
    // Tidak melewati slip terakhir orang yang tanggal berhentinya tercatat: sisanya menumpuk di slip terakhir.
    out.push(lastPeriod && period > lastPeriod ? lastPeriod : period);
    period = addPeriods(period, 1);
  }
  return out;
}
