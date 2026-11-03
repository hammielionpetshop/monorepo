import { bonusOf, netLineAmount } from '@petshop/shared/utils/grooming-bonus';

// Aturan murni Buku Bonus L4d-1 (spec L4d §3.1–§3.3): nominal, status lahir, dan penyamaan dengan data kasir.

export type BonusKind = 'GROOMING' | 'DELIVERY';
export type BonusStatus = 'HELD' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'IN_SLIP' | 'FORFEITED';

export const BONUS_KIND_LABELS: Record<BonusKind, string> = { GROOMING: 'Grooming', DELIVERY: 'Ongkir' };

/** Jenis baris Buku Bonus: dari kasir (Grooming, Ongkir) atau jenis ketik (L4d-2, nama dari `bonus_types`). */
export type EntryKind = BonusKind | 'TYPED';

/** Nama jenis satu baris Buku Bonus. */
export const entryKindLabel = (kind: string, typeName: string | null | undefined) =>
  kind === 'TYPED' ? typeName ?? 'Bonus Bebas' : BONUS_KIND_LABELS[kind as BonusKind] ?? kind;

/**
 * Pemeriksaan Bonus Bebas (spec L4d §3.1, §5): untuk karyawan selain Pemilik, GM, dan pencatatnya sendiri;
 * nominal rupiah bulat > 0; alasan ≥ 15 huruf; tanggal tidak di masa depan. Null = boleh.
 */
export function freeBonusProblem(input: {
  amount: number; reason: string; occurredOn: string; today: string; self: boolean; recipientRole: 'GM' | 'OWNER' | 'STAFF';
}): string | null {
  if (input.self) return 'Bonus Bebas untuk diri sendiri tidak bisa dicatat.';
  if (input.recipientRole !== 'STAFF') return 'Pemilik dan GM tidak menerima Bonus Bebas.';
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 1_000_000_000) return 'Nominal harus rupiah bulat lebih dari 0.';
  if (input.reason.trim().length < 15) return 'Alasan paling sedikit 15 huruf.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) return 'Tanggal tidak valid.';
  if (input.occurredOn > input.today) return 'Tanggal bonus tidak boleh di masa depan.';
  return null;
}
export const BONUS_STATUS_LABELS: Record<BonusStatus, string> = {
  HELD: 'Ditahan', PENDING: 'Menunggu', APPROVED: 'Disahkan', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan', IN_SLIP: 'Masuk slip', FORFEITED: 'Hangus',
};

/** Satu baris jasa/ongkir dari view POS, sudah dibaca menjadi angka. */
export type PosService = {
  kind: BonusKind;
  refId: number;
  /** Grooming: DIAMBIL; ongkir: tidak dibatalkan, tidak gratis, ongkir bersih > 0. */
  eligible: boolean;
  posGroomerId: number;
  occurredOn: string | null;
  kasirBranchId: number;
  branchName: string;
  trxNumber: string;
  serviceName: string;
  lineTotal: number;
  payableAmount: number;
  linesTotal: number;
  groomerChanged: boolean;
};

export const originKeyOf = (s: Pick<PosService, 'kind' | 'refId'>) => `${s.kind}:${s.refId}`;

export function baseOf(s: Pick<PosService, 'lineTotal' | 'payableAmount' | 'linesTotal'>): number {
  return netLineAmount(s.lineTotal, s.payableAmount, s.linesTotal);
}

export function amountOf(base: number, percent: number): number {
  return bonusOf(base, percent);
}

/** Hak penerima pada tanggal kejadian (GAJ-09, 83; KAR-67). */
export type Recipient = { employeeId: number; role: 'GM' | 'OWNER' | 'STAFF'; eligibleFlag: boolean };

/**
 * Status lahir: GM tidak pernah (null = tidak ada baris); Pemilik hanya Grooming bila jabatannya bertanda;
 * di luar jabatan penerima → Ditahan; Grooming → Menunggu; Ongkir → Disahkan tanpa pengesahan.
 */
export function birthStatus(kind: BonusKind, recipient: Recipient): BonusStatus | null {
  if (recipient.role === 'GM') return null;
  if (recipient.role === 'OWNER' && kind !== 'GROOMING') return null;
  if (!recipient.eligibleFlag) return 'HELD';
  return kind === 'GROOMING' ? 'PENDING' : 'APPROVED';
}

/** Keadaan yang diinginkan dari data kasir; null = tidak boleh ada baris (batal, belum/bukan karyawan, GM). */
export type Desired = { employeeId: number; status: BonusStatus; base: number; percent: number; amount: number; occurredOn: string; posGroomerId: number } | null;

export type LiveEntry = {
  id: number; kind: BonusKind; employeeId: number; status: BonusStatus; amount: number; occurredOn: string; posGroomerId: number | null;
};

/** Sidik keadaan untuk membandingkan baris final dengan POS (dan dengan keputusan Terima/Biarkan sebelumnya). */
export function fingerprint(d: Desired): string {
  return d ? `${d.employeeId}:${d.amount}:${d.occurredOn}` : 'CANCELLED';
}

export type SyncAction =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'status'; status: BonusStatus }
  | { kind: 'replace'; flag: 'GROOMER_CHANGED' | 'CHANGED_FROM_POS' }
  | { kind: 'cancel' }
  | { kind: 'flag_change' };

/**
 * Penyamaan satu kunci asal (GAJ-90):
 * - belum final (Grooming Ditahan/Menunggu; Ongkir Ditahan/Disahkan di periode belum terkunci): batal + tulis ulang bertanda;
 * - final (Grooming Disahkan; Ongkir di periode terkunci): daftar periksa HR, kecuali keadaan itu sudah pernah diputuskan.
 */
export function reconcile(existing: LiveEntry | null, desired: Desired, opts: { periodLocked: boolean; decidedFingerprints: readonly string[] }): SyncAction {
  if (!existing) return desired ? { kind: 'create' } : { kind: 'none' };
  if (existing.status === 'REJECTED' || existing.status === 'CANCELLED') return { kind: 'none' };
  const same = desired != null && desired.employeeId === existing.employeeId && desired.amount === existing.amount && desired.occurredOn === existing.occurredOn;
  // Masuk slip tertutup selalu final (L4e-1).
  const final = existing.status === 'IN_SLIP' || existing.status === 'FORFEITED' || (existing.kind === 'GROOMING' ? existing.status === 'APPROVED' : opts.periodLocked);
  if (final) {
    if (same) return { kind: 'none' };
    return opts.decidedFingerprints.includes(fingerprint(desired)) ? { kind: 'none' } : { kind: 'flag_change' };
  }
  if (!desired) return { kind: 'cancel' };
  if (same) return desired.status !== existing.status ? { kind: 'status', status: desired.status } : { kind: 'none' };
  return { kind: 'replace', flag: existing.posGroomerId != null && existing.posGroomerId !== desired.posGroomerId ? 'GROOMER_CHANGED' : 'CHANGED_FROM_POS' };
}

/**
 * Akibat "Terima perubahan" atas baris final: koreksi minus untuk penerima lama dan, bila penerima atau nominal
 * berubah, baris koreksi plus untuk penerima (baru). Jumlah koreksi = keadaan baru − keadaan lama.
 */
export function correctionsFor(entry: { employeeId: number; amount: number }, after: Desired): { employeeId: number; amount: number }[] {
  if (!after) return [{ employeeId: entry.employeeId, amount: -entry.amount }];
  if (after.employeeId === entry.employeeId) {
    const diff = after.amount - entry.amount;
    return diff === 0 ? [] : [{ employeeId: entry.employeeId, amount: diff }];
  }
  return [{ employeeId: entry.employeeId, amount: -entry.amount }, ...(after.amount > 0 ? [{ employeeId: after.employeeId, amount: after.amount }] : [])];
}

/** Judul jumlah per jenis: "Bonus grooming", "Bonus ongkir", atau nama jenis ketik apa adanya ("Bonus Bebas"). */
export const bonusTitle = (label: string) => (/^bonus\b/i.test(label) ? label : `Bonus ${label.toLowerCase()}`);
