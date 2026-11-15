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

export type SlipKind = 'MONTHLY' | 'WEEKLY';

/**
 * Jalur slip utama tujuan cicilan (DRV-65, 132): bulanan 26–25 atau minggu upah (hari awal bertanggal, L7b-1).
 * Kalender minggu dibaca server dari modul Logistik lalu dibungkus di sini supaya aturan jadwal tetap murni.
 */
export type SlipTrack = {
  kind: SlipKind;
  /** Awal periode slip yang memuat tanggal ini. */
  startOf: (date: IsoDate) => IsoDate;
  /** Awal periode sesudah periode yang dimulai `start`. */
  next: (start: IsoDate) => IsoDate;
  endOf: (start: IsoDate) => IsoDate;
};

export const MONTHLY_TRACK: SlipTrack = { kind: 'MONTHLY', startOf: periodStartOf, next: (start) => addPeriods(start, 1), endOf: periodEndOf };

/** Jalur mingguan dari fungsi minggu upah (`weekOf` modul Logistik). */
export function weeklyTrack(weekOf: (date: IsoDate) => { start: IsoDate; end: IsoDate }): SlipTrack {
  return { kind: 'WEEKLY', startOf: (date) => weekOf(date).start, next: (start) => weekOf(addDays(weekOf(start).end, 1)).start, endOf: (start) => weekOf(start).end };
}

/** Label periode cicilan: bulanan "26 Oktober 2026 – 25 November 2026", mingguan "minggu 30 Oktober 2026". */
export const periodLabel = (start: IsoDate, kind: SlipKind = 'MONTHLY') => (kind === 'WEEKLY' ? `minggu ${longDate(start)}` : `${longDate(start)} – ${longDate(periodEndOf(start))}`);

/** n periode sesudah `start` pada jalur itu. */
export function stepPeriods(start: IsoDate, count: number, track: SlipTrack): IsoDate {
  let period = start;
  for (let i = 0; i < count; i += 1) period = track.next(period);
  return period;
}

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
export const MSG_NO_SLIP = 'Kasbon hanya untuk karyawan yang menerima slip gaji.';
export const MSG_LEAVING = 'Kasbon tidak bisa diajukan karena tanggal berhenti Anda sudah tercatat. Kalau mendesak, hubungi GM.';
export const MSG_INACTIVE = 'Kasbon hanya untuk karyawan aktif.';
export const MSG_PENDING = 'Masih ada pengajuan kasbon yang menunggu. Batalkan dulu kalau ingin mengubahnya.';

/** Kalimat masa kerja memakai angka pengaturan (isi awal 6 bulan = kalimat v3 apa adanya). */
export const tenureMessage = (months: number) => (months === 6 ? MSG_TENURE : `Kasbon baru bisa diajukan setelah ${months} bulan bekerja. Kalau mendesak, hubungi GM.`);

export type CheckFacts = {
  active: boolean;
  /** Dasar gaji jabatan hari ini; Mingguan dibuka sejak L7b-2 (slip mingguan ada) dan tidak memerlukan paket gaji bulanan. */
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
  if (!facts.payBasis || (facts.payBasis === 'MONTHLY' && !facts.hasPackage)) return { ok: false, step: 'ELIGIBLE', message: MSG_NO_SLIP };
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
export function placeSchedule(
  amounts: readonly number[], moneyDate: IsoDate, closed: ReadonlySet<IsoDate>, lastPeriod: IsoDate | null = null, track: SlipTrack = MONTHLY_TRACK,
): IsoDate[] {
  return placeFrom(amounts.length, track.startOf(moneyDate), closed, lastPeriod, track);
}

// ---- L5b: sesudah diberikan (spec L5 §3.9–3.11) ----

/** Periode belum ditutup pertama mulai `from` (melewati yang sudah Ditutup). */
export function nextOpenPeriod(from: IsoDate, closed: ReadonlySet<IsoDate>, track: SlipTrack = MONTHLY_TRACK): IsoDate {
  let period = from;
  while (closed.has(period)) period = track.next(period);
  return period;
}

export type ScheduledPiece = { id: number; amount: number; periodStart: IsoDate };
export type CarriedPiece = { id: number; amount: number };

/**
 * Urutan pengurangan pelunasan dan hapus utang (DRV-69, 70, 136, 137): sisa potongan yang dibawa lebih dulu, lalu
 * cicilan Terjadwal terdekat. Mengembalikan bagian yang diambil dari tiap sisa dibawa dan nominal baru tiap cicilan
 * (0 = cicilan itu habis). Tidak boleh lebih dari sisa.
 */
export function reduceOrder(amount: number, carried: readonly CarriedPiece[], scheduled: readonly ScheduledPiece[]) {
  let left = amount;
  const fromCarry: { id: number; take: number; rest: number }[] = [];
  for (const c of carried) {
    if (left <= 0) break;
    const take = Math.min(c.amount, left);
    fromCarry.push({ id: c.id, take, rest: c.amount - take });
    left -= take;
  }
  const ordered = [...scheduled].sort((a, b) => (a.periodStart === b.periodStart ? a.id - b.id : a.periodStart < b.periodStart ? -1 : 1));
  const schedule = ordered.map((s) => {
    const take = Math.min(s.amount, left);
    left -= take;
    return { id: s.id, periodStart: s.periodStart, amount: s.amount - take };
  });
  return { fromCarry, schedule, left };
}

/** Nominal pelunasan / hapus: rupiah bulat > 0 dan ≤ sisa. */
export function reduceAmountProblem(amount: number, remaining: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return 'Nominal harus rupiah bulat lebih dari 0.';
  if (amount > remaining) return `Paling banyak sebesar sisa kasbon (${rupiah(remaining)}).`;
  return null;
}

/** Tanggal uang pelunasan tunai (DRV-136): tidak masa depan, tidak sebelum tanggal diberikan, mundur > 7 hari wajib alasan. */
export function repayDateProblem(input: { moneyDate: string; today: IsoDate; handedOn: IsoDate; reason: string | null }): string | null {
  const { moneyDate, today, handedOn } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moneyDate) || Number.isNaN(Date.parse(`${moneyDate}T00:00:00Z`))) return 'Tanggal uang tidak sah.';
  if (moneyDate > today) return 'Tanggal uang tidak boleh sesudah hari ini.';
  if (moneyDate < handedOn) return 'Tanggal uang tidak boleh sebelum kasbon diberikan.';
  if (daysBetween(moneyDate, today) > MONEY_DATE_FREE_DAYS && (input.reason ?? '').trim().length < 15) {
    return `Tanggal uang lebih dari ${MONEY_DATE_FREE_DAYS} hari lalu: tulis alasannya, paling sedikit 15 huruf.`;
  }
  return null;
}

/**
 * Tunda cicilan disetujui (DRV-68, 134): semua cicilan Terjadwal bergeser satu periode (melewati slip yang sudah
 * Ditutup); sisa dibawa tidak ikut.
 */
export function postponePeriods(periods: readonly IsoDate[], closed: ReadonlySet<IsoDate>, track: SlipTrack = MONTHLY_TRACK): IsoDate[] {
  return periods.map((p) => nextOpenPeriod(track.next(p), closed, track));
}

/** Syarat minta tunda (DRV-134). Mengembalikan kalimat penolakan, atau null. */
export function postponeProblem(input: { stage: AdvanceStage; used: number; quota: number; hasOpenScheduled: boolean; pending: boolean; leaving: boolean }): string | null {
  if (input.stage !== 'RUNNING') return 'Hanya kasbon yang sedang berjalan yang bisa ditunda.';
  if (input.leaving) return 'Cicilan tidak bisa ditunda karena tanggal berhenti sudah tercatat.';
  if (input.used >= input.quota) return input.quota === 1 ? 'Kasbon ini sudah pernah ditunda. Tunda hanya 1 kali per kasbon.' : `Kasbon ini sudah ditunda ${input.used} kali (jatah ${input.quota}).`;
  if (input.pending) return 'Masih ada permintaan tunda kasbon ini yang menunggu.';
  if (!input.hasOpenScheduled) return 'Tidak ada cicilan yang menunggu dipotong di slip yang masih Perkiraan.';
  return null;
}

/**
 * Ubah jadwal (DRV-69, 135): banyaknya 1 s.d. batas; periode mulai belum ditutup, tidak sebelum slip terbuka terdekat,
 * paling jauh N periode sesudahnya, dan tidak melewati slip terakhir orang yang berhenti.
 */
export function rescheduleProblem(input: {
  count: number; maxCount: number; start: string; nearestOpen: IsoDate; maxAhead: number; closed: ReadonlySet<IsoDate>; lastPeriod: IsoDate | null; total: number;
  track?: SlipTrack;
}): string | null {
  const track = input.track ?? MONTHLY_TRACK;
  const { count, maxCount, start, nearestOpen } = input;
  if (input.total <= 0) return 'Tidak ada cicilan yang menunggu dipotong.';
  if (!Number.isInteger(count) || count < 1 || count > maxCount) return `Banyaknya cicilan 1 sampai ${maxCount}.`;
  if (count > input.total) return 'Banyaknya cicilan tidak boleh lebih dari nominal rupiahnya.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`)) || track.startOf(start) !== start) return 'Pilih gajian mulai.';
  if (input.closed.has(start)) return 'Slip gajian itu sudah ditutup.';
  if (start < nearestOpen) return 'Gajian mulai tidak boleh sebelum slip terbuka terdekat.';
  if (start > stepPeriods(nearestOpen, input.maxAhead, track)) return `Gajian mulai paling jauh ${input.maxAhead} gajian sesudah slip terbuka terdekat.`;
  if (input.lastPeriod && start > input.lastPeriod) return 'Gajian mulai melewati slip terakhir orang ini.';
  return null;
}

/** Pasang cicilan berturut-turut mulai periode tertentu (ubah jadwal, Kasbon Khusus sesudah diberikan). */
export function placeFrom(count: number, start: IsoDate, closed: ReadonlySet<IsoDate>, lastPeriod: IsoDate | null, track: SlipTrack = MONTHLY_TRACK): IsoDate[] {
  const out: IsoDate[] = [];
  let period = start;
  for (let i = 0; i < count; i += 1) {
    period = nextOpenPeriod(period, closed, track);
    // Tidak melewati slip terakhir orang yang tanggal berhentinya tercatat: sisanya menumpuk di slip terakhir.
    out.push(lastPeriod && period > lastPeriod ? lastPeriod : period);
    period = track.next(period);
  }
  return out;
}

/**
 * Ganti slip utama (DRV-140): periode pertama jalur baru yang dimulai pada atau sesudah tanggal pindah. Cicilan yang
 * dipasang ulang mulai dari sini, banyak dan nominalnya tetap. `startFits` = awal periode yang memuat tanggal pindah sudah
 * di jalur baru juga (mis. perubahan jabatan dibatalkan: orangnya tidak pernah pindah), maka periode itu dipakai.
 */
export function firstPeriodFrom(switchDate: IsoDate, track: SlipTrack, startFits = false): IsoDate {
  const start = track.startOf(switchDate);
  return start < switchDate && !startFits ? track.next(start) : start;
}

export const SPECIAL_EVENT_KINDS_DEFAULT = ['Kecelakaan', 'Sakit', 'Duka', 'Lainnya'];

/** Bulan kalender `YYYY-MM` dari tanggal; dipakai tab Uang Kasbon (spec L5 §9 butir 4). */
export const monthOf = (date: IsoDate) => date.slice(0, 7);

// ---- L9a: sisa kasbon bawaan sistem lama (spec L9 §3.1, SIS-28) ----

/** SIS-28: paling banyak 3 kali potong, tetap walau pengaturan kasbon biasa berubah. */
export const LEGACY_MAX_INSTALLMENTS = 3;
/** Pemeriksaan isian kasbon bawaan (murni; dipakai server dan tes). */
export function legacyInputProblem(input: { amount: number; installments: number; note: string }): string | null {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Isi sisa kasbon dalam rupiah, lebih dari 0.';
  const count = installmentsProblem(input.installments, LEGACY_MAX_INSTALLMENTS);
  if (count) return count;
  if (input.note.length > 300) return 'Catatan paling panjang 300 huruf.';
  return null;
}
