// Uang dan laporan di toko (spec LT1 §13.2, §13.5, LT1b-3). Aturan murni: cara bayar, nominal, laporan kunjungan. Tanpa DB.
import Big from 'big.js';
import { REASON_MIN, addDays, type IsoDate } from './trip';

export type PaymentMethod = 'NONE' | 'CASH' | 'TRANSFER' | 'PARTIAL' | 'TEMPO';
/** Pilihan awak saat ada tagihan (NONE dicatat sendiri bila tagihan 0). */
export type ChosenMethod = Exclude<PaymentMethod, 'NONE'>;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  NONE: 'Tidak ada tagihan (lunas di kasir)', CASH: 'Lunas cash', TRANSFER: 'Lunas transfer', PARTIAL: 'Bayar sebagian (titip cash)', TEMPO: 'Tempo',
};
export const PAYMENT_HINTS: Record<ChosenMethod, string> = {
  CASH: 'Toko membayar seluruh tagihan dengan uang tunai.',
  TRANSFER: 'Toko mentransfer seluruh tagihan. Wajib foto bukti transfer.',
  PARTIAL: 'Toko membayar sebagian dengan uang tunai; sisanya ditagih kantor.',
  TEMPO: 'Tidak ada uang dan tidak ada bukti transfer; seluruh tagihan ditagih kantor.',
};
export const CHOSEN_METHODS: ChosenMethod[] = ['CASH', 'TRANSFER', 'PARTIAL', 'TEMPO'];

/** Tagihan kunjungan = jumlah sisa piutang nota-notanya (rupiah bulat, big.js). */
export function billOf(remaining: number[]): number {
  return Number(remaining.reduce((sum, n) => sum.plus(Math.max(0, Math.round(n))), new Big(0)));
}

/**
 * Cara bayar (§13.5 butir 2). Tagihan 0 → NONE apa pun pilihannya. Mengembalikan nominal diterima, atau pesan salah.
 * Bukti transfer diperiksa pemanggil (foto).
 */
export function cleanPayment(bill: number, method: string | null | undefined, partialAmount: number | null | undefined):
  { ok: true; method: PaymentMethod; received: number } | { ok: false; error: string } {
  if (!Number.isInteger(bill) || bill < 0) return { ok: false, error: 'Tagihan tidak valid.' };
  if (bill === 0) return { ok: true, method: 'NONE', received: 0 };
  if (!CHOSEN_METHODS.includes(method as ChosenMethod)) return { ok: false, error: 'Pilih cara bayar toko.' };
  const chosen = method as ChosenMethod;
  if (chosen === 'CASH' || chosen === 'TRANSFER') return { ok: true, method: chosen, received: bill };
  if (chosen === 'TEMPO') return { ok: true, method: chosen, received: 0 };
  if (partialAmount == null || !Number.isInteger(partialAmount) || partialAmount <= 0) return { ok: false, error: 'Isi uang yang diterima (rupiah).' };
  if (partialAmount >= bill) return { ok: false, error: 'Uang yang diterima sama dengan tagihan atau lebih: pilih Lunas cash.' };
  return { ok: true, method: chosen, received: partialAmount };
}

/** Sisa yang ditagih kantor sesudah kunjungan. */
export function leftToCollect(method: PaymentMethod, bill: number, received: number): number {
  return method === 'PARTIAL' || method === 'TEMPO' ? Number(new Big(bill).minus(received)) : 0;
}

export type ReportKind = 'WRONG_ITEM' | 'SHORT' | 'DAMAGED' | 'PRICE' | 'RETURN' | 'OTHER';
export const REPORT_KINDS: { code: ReportKind; label: string }[] = [
  { code: 'WRONG_ITEM', label: 'Barang salah' }, { code: 'SHORT', label: 'Barang kurang' }, { code: 'DAMAGED', label: 'Barang rusak' },
  { code: 'PRICE', label: 'Harga beda' }, { code: 'RETURN', label: 'Retur (dibawa pulang)' }, { code: 'OTHER', label: 'Kendala lain' },
];
export const REPORT_LABELS = Object.fromEntries(REPORT_KINDS.map((k) => [k.code, k.label])) as Record<ReportKind, string>;

/** Laporan kunjungan (§13.5 butir 4, §14.2 butir 2): jenis baku, catatan ≤ 300 (wajib ≥ 5 huruf untuk Kendala lain dan Harga beda). */
export function cleanReport(kind: string | null | undefined, note: string | null | undefined):
  { ok: true; kind: ReportKind; note: string | null } | { ok: false; error: string } {
  if (!REPORT_KINDS.some((k) => k.code === kind)) return { ok: false, error: 'Pilih jenis laporan.' };
  const text = (note ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > 300) return { ok: false, error: 'Catatan paling panjang 300 huruf.' };
  if (kind === 'OTHER' && text.length < REASON_MIN) return { ok: false, error: `Ceritakan kendalanya, paling sedikit ${REASON_MIN} huruf.` };
  if (kind === 'PRICE' && text.length < REASON_MIN) return { ok: false, error: `Tulis harga yang diminta toko, paling sedikit ${REASON_MIN} huruf.` };
  return { ok: true, kind: kind as ReportKind, note: text || null };
}

/** Janji bayar sisa (spec LT1 §14.2 butir 5; LOG-113): bawaan 7 hari, paling lama 60 hari sesudah hari kunjungan. */
export const PROMISE_DEFAULT_DAYS = 7;
export const PROMISE_MAX_DAYS = 60;
export const needsPromise = (method: PaymentMethod) => method === 'PARTIAL' || method === 'TEMPO';

/** Tanggal janji bayar: wajib untuk Bayar sebagian / Tempo, besok s.d. hari + 60; selain itu selalu kosong. */
export function cleanPromise(method: PaymentMethod, value: string | null | undefined, today: IsoDate):
  { ok: true; date: IsoDate | null } | { ok: false; error: string } {
  if (!needsPromise(method)) return { ok: true, date: null };
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: 'Isi tanggal janji bayar sisa.' };
  if (value <= today) return { ok: false, error: 'Tanggal janji bayar paling cepat besok.' };
  if (value > addDays(today, PROMISE_MAX_DAYS)) return { ok: false, error: `Tanggal janji bayar paling lama ${PROMISE_MAX_DAYS} hari.` };
  return { ok: true, date: value };
}

/** Lewat janji: tanggal janji sudah lewat dan piutang kasir nota kunjungan itu masih ada. */
export const promiseOverdue = (promise: IsoDate | null, today: IsoDate, debtLeft: number) => !!promise && promise < today && debtLeft > 0;

export type Decision = 'CUT' | 'RETURN_BO' | 'NO_CUT';
export const DECISION_LABELS: Record<Decision, string> = { CUT: 'Potong nota', RETURN_BO: 'Dicatat lewat Retur BO', NO_CUT: 'Tidak dipotong' };
export type CutReason = 'WRONG_ITEM' | 'SHORT' | 'DAMAGED' | 'PRICE' | 'REJECTED' | 'OTHER';
export const CUT_REASONS: { code: CutReason; label: string }[] = [
  { code: 'WRONG_ITEM', label: 'Barang salah' }, { code: 'SHORT', label: 'Barang kurang' }, { code: 'DAMAGED', label: 'Barang rusak' },
  { code: 'PRICE', label: 'Harga beda' }, { code: 'REJECTED', label: 'Ditolak toko' }, { code: 'OTHER', label: 'Lainnya' },
];
export const CUT_REASON_LABELS = Object.fromEntries(CUT_REASONS.map((r) => [r.code, r.label])) as Record<CutReason, string>;
/** Alasan bawaan dari jenis laporan driver. */
export const cutReasonOf = (kind: ReportKind): CutReason => (kind === 'RETURN' ? 'OTHER' : kind);

export type DecisionInput = { decision?: string | null; noteId?: number | null; amount?: number | null; reason?: string | null; note?: string | null };
export type CleanDecision = { decision: Decision; noteId: number | null; amount: number | null; reason: CutReason | null; note: string | null };

/**
 * Keputusan atas laporan toko (§14.2 butir 1). `notes` = nota (surat jalan SALE) kunjungan itu dengan nominal kasirnya dan
 * jumlah potongan lain yang masih berlaku. Potongan tidak boleh melebihi nota (dikurangi potongan lain).
 */
export function cleanDecision(
  kind: ReportKind, input: DecisionInput, notes: { id: number; amount: number; otherCuts: number }[],
  options: { noteOptional?: boolean } = {},
): { ok: true; value: CleanDecision } | { ok: false; error: string } {
  const note = (input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 500) || null;
  const decision = input.decision as Decision;
  if (!(decision in DECISION_LABELS)) return { ok: false, error: 'Pilih keputusan.' };
  if (decision === 'NO_CUT') {
    if (!note || note.length < REASON_MIN) return { ok: false, error: `Catatan paling sedikit ${REASON_MIN} huruf.` };
    return { ok: true, value: { decision, noteId: null, amount: null, reason: null, note } };
  }
  if (decision === 'RETURN_BO' && kind !== 'RETURN') return { ok: false, error: 'Retur BO hanya untuk laporan Retur.' };
  // Jemput retur (A2) tidak punya nota trip: Retur BO tanpa nota; potong nota tidak tersedia.
  if (options.noteOptional && !notes.length) {
    if (decision === 'RETURN_BO') return { ok: true, value: { decision, noteId: null, amount: null, reason: null, note } };
    return { ok: false, error: 'Retur jemputan diputuskan lewat Retur BO atau Tidak dipotong.' };
  }
  const target = notes.find((n) => n.id === input.noteId);
  if (!target) return { ok: false, error: notes.length ? 'Pilih nota.' : 'Kunjungan ini tidak punya nota kasir.' };
  if (decision === 'RETURN_BO') return { ok: true, value: { decision, noteId: target.id, amount: null, reason: null, note } };
  if (!CUT_REASONS.some((r) => r.code === input.reason)) return { ok: false, error: 'Pilih alasan potongan.' };
  const amount = input.amount;
  if (amount == null || !Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Isi nominal potongan (rupiah).' };
  const room = Number(new Big(target.amount).minus(target.otherCuts));
  if (amount > room) return { ok: false, error: `Potongan melebihi nota (sisa yang bisa dipotong Rp ${Math.max(0, room).toLocaleString('id-ID')}).` };
  if (input.reason === 'OTHER' && (!note || note.length < REASON_MIN)) return { ok: false, error: `Alasan Lainnya wajib catatan paling sedikit ${REASON_MIN} huruf.` };
  return { ok: true, value: { decision, noteId: target.id, amount, reason: input.reason as CutReason, note } };
}

/** Nomor referensi Sudah dicatat di kasir (§14.2 butir 3): 3–100 huruf. */
export function cleanRecordedRef(value: string | null | undefined): { ok: true; ref: string } | { ok: false; error: string } {
  const ref = (value ?? '').replace(/\s+/g, ' ').trim();
  if (ref.length < 3) return { ok: false, error: 'Isi nomor retur / nomor nota / keterangan pencatatan, paling sedikit 3 huruf.' };
  return { ok: true, ref: ref.slice(0, 100) };
}

/** Hari tunggu sebelum keputusan belum dicatat di kasir ditandai merah di Beranda (§14.2 butir 3). */
export const UNRECORDED_RED_DAYS = 3;

/** Batas atas uang titipan sekali kunjungan (salah ketik nol berlebih). */
export const DEPOSIT_MAX = 100_000_000;

/**
 * Titipan toko saat Terkirim (A1): Lunas + titip (Lunas cash dengan uang tunai > tagihan) atau Titip saja (tagihan 0).
 * Mengembalikan nominal titipan (0 = tanpa titipan), atau pesan salah.
 */
export function cleanDeposit(bill: number, method: PaymentMethod, deposit: number | null | undefined):
  { ok: true; amount: number } | { ok: false; error: string } {
  if (deposit == null || deposit === 0) return { ok: true, amount: 0 };
  if (!Number.isInteger(deposit) || deposit < 0) return { ok: false, error: 'Nominal titipan harus rupiah bulat.' };
  if (deposit > DEPOSIT_MAX) return { ok: false, error: 'Nominal titipan terlalu besar. Periksa lagi angkanya.' };
  if (method !== 'CASH' && !(method === 'NONE' && bill === 0)) return { ok: false, error: 'Titipan hanya untuk Lunas cash (lebih bayar) atau kunjungan tanpa tagihan.' };
  return { ok: true, amount: deposit };
}

export type DepositKind = 'IN' | 'USE' | 'REFUND';
export const DEPOSIT_KIND_LABELS: Record<DepositKind, string> = { IN: 'Titipan masuk', USE: 'Dipakai untuk nota', REFUND: 'Dikembalikan tunai' };

/** Saldo titipan: titipan diperiksa (angka sebenarnya) − pemakaian − pengembalian yang tidak batal (big.js). */
export function depositBalance(rows: { kind: DepositKind; amount: number; actualAmount: number | null; voided: boolean }[]): number {
  return Number(rows.reduce((sum, r) => {
    if (r.voided) return sum;
    if (r.kind === 'IN') return r.actualAmount == null ? sum : sum.plus(r.actualAmount);
    return sum.minus(r.amount);
  }, new Big(0)));
}
