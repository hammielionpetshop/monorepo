import Big from 'big.js';
import { addDays, type IsoDate } from './salary';

// Aturan murni Laporan Bongkaran (spec L8 §3.1–3.3; DRV-35, 36, 42, 43, 105, 108). Tanpa DB, tanpa React.

export const MIN_REASON = 15;
export const MAX_PHOTOS = 5;
/** Berat di atas ini per satuan meminta konfirmasi sekali (DRV-105). */
export const HEAVY_WEIGHT_KG = 100;
/** Pencarian barang paling sedikit 2 huruf; "Barang tidak ada di daftar" baru muncul sesudah pencarian ≥ 3 huruf kosong (DRV-109). */
export const SEARCH_MIN = 2;
export const OTHER_SEARCH_MIN = 3;
/** "Sering ikut" = peserta bongkaran dalam sekian hari terakhir. */
export const FREQUENT_DAYS = 30;

export type UnloadingStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'PAID' | 'CANCELLED';
export const UNLOADING_STATUS_LABELS: Record<UnloadingStatus, string> = {
  PENDING: 'Menunggu persetujuan', ACTIVE: 'Berlaku · belum dibayar', REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', PAID: 'Dibayar', CANCELLED: 'Dibatalkan',
};

export type UnloadingFlag = 'CREATOR_JOINED' | 'OTHER_ITEM' | 'WEIGHT_CHANGED' | 'NO_DELIVERY_NOTE' | 'BACKDATED' | 'SIMILAR' | 'CORRECTED' | 'ASKED' | 'PO_DIFF';
export const UNLOADING_FLAG_LABELS: Record<UnloadingFlag, string> = {
  CREATOR_JOINED: 'Pembuat ikut jadi peserta', OTHER_ITEM: 'Barang lain', WEIGHT_CHANGED: 'Berat berubah', NO_DELIVERY_NOTE: 'Tanpa surat jalan',
  BACKDATED: 'Tanggal mundur', SIMILAR: 'Serupa', CORRECTED: 'Dikoreksi', ASKED: 'Ditanyakan Finance', PO_DIFF: 'Selisih dengan PO',
};

/** Status hari yang membuat baris upah bertanda Perlu dilihat untuk HR (DRV-107). */
export const LOOK_DAY_STATUSES = ['PERMIT', 'SICK', 'LEAVE', 'ALPHA'] as const;
export const DAY_STATUS_LABELS: Record<string, string> = { PERMIT: 'izin', SICK: 'sakit', LEAVE: 'cuti', ALPHA: 'alpha' };
export const needsLook = (dayStatus: string | null) => !!dayStatus && (LOOK_DAY_STATUSES as readonly string[]).includes(dayStatus);

/** Angka desimal ≤ 3 angka di belakang koma, > 0 (kg atau jumlah barang). Mengembalikan teks baku ("12.5" → "12.500") atau null. */
export function parseDecimal3(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(text)) return null;
  const n = new Big(text);
  return n.gt(0) ? n.toFixed(3) : null;
}

/** Teks kg untuk layar: "8.960 kg" → "8.960" memakai pemisah ribuan Indonesia, desimal koma, tanpa nol di belakang. */
export function kgText(value: string | number): string {
  const n = new Big(value);
  const [int, dec] = n.round(3, Big.roundHalfUp).toFixed(3).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmed = dec.replace(/0+$/, '');
  return trimmed ? `${grouped},${trimmed}` : grouped;
}

export type ItemInput =
  | { kind: 'PRODUCT'; quantity: string; weightKg: string }
  | { kind: 'OTHER'; kg: string };

export type ParticipantInput = { key: string; name: string; /** Urutan terdaftar (lebih kecil = lebih dulu), pemecah nama kembar. */ order: number };

export type UnloadingResult = {
  lineKg: string[];
  totalKg: string;
  rate: number;
  totalPay: number;
  shares: { key: string; amount: number; plusOne: boolean }[];
};

/** Urutan abjad nama lengkap, huruf besar/kecil diabaikan; nama sama persis: yang lebih dulu terdaftar (DRV-108). */
export function alphabetical(participants: readonly ParticipantInput[]): ParticipantInput[] {
  return [...participants].sort((a, b) => {
    const x = a.name.trim().toLowerCase();
    const y = b.name.trim().toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a.order - b.order || (a.key < b.key ? -1 : 1);
  });
}

/**
 * Satu fungsi "hitung bongkaran" (DRV-35, 43, 108): kg baris = jumlah × berat (3 desimal, setengah ke atas); total kg = jumlah kg baris;
 * total upah = total kg × tarif dibulatkan ke rupiah terdekat (setengah ke atas); bagian = hasil bagi dibulatkan ke bawah, sisa Rp1 per orang
 * menurut abjad. Jumlah bagian selalu = total upah. Melempar Error berpesan bila isian tidak sah.
 */
export function computeUnloading(items: readonly ItemInput[], participants: readonly ParticipantInput[], rate: number): UnloadingResult {
  if (!items.length) throw new Error('Isi paling sedikit satu barang.');
  if (!participants.length) throw new Error('Pilih paling sedikit satu peserta.');
  if (new Set(participants.map((p) => p.key)).size !== participants.length) throw new Error('Satu orang hanya boleh tercantum sekali.');
  if (!Number.isInteger(rate) || rate < 0) throw new Error('Tarif bongkaran tidak sah.');
  const lineKg = items.map((item) => {
    const kg = item.kind === 'PRODUCT' ? new Big(item.quantity).times(item.weightKg).round(3, Big.roundHalfUp) : new Big(item.kg).round(3, Big.roundHalfUp);
    if (kg.lte(0)) throw new Error('Kg tiap barang harus lebih dari 0.');
    return kg;
  });
  const totalKg = lineKg.reduce((sum, kg) => sum.plus(kg), new Big(0));
  if (totalKg.lte(0)) throw new Error('Total kg harus lebih dari 0.');
  const totalPay = Number(totalKg.times(rate).round(0, Big.roundHalfUp).toFixed(0));
  const count = participants.length;
  const base = Math.floor(totalPay / count);
  let rest = totalPay - base * count;
  const ordered = alphabetical(participants);
  const extra = new Set<string>();
  for (const p of ordered) {
    if (rest <= 0) break;
    extra.add(p.key);
    rest -= 1;
  }
  return {
    lineKg: lineKg.map((kg) => kg.toFixed(3)),
    totalKg: totalKg.toFixed(3),
    rate,
    totalPay,
    shares: participants.map((p) => ({ key: p.key, amount: base + (extra.has(p.key) ? 1 : 0), plusOne: extra.has(p.key) })),
  };
}

/**
 * Tanggal kerja (DRV-36, 104): tidak masa depan; mundur ≤ batas = langsung; lebih jauh = terlambat (alasan wajib, menunggu Pemilik/GM).
 * `base` = hari laporan dibuat (koreksi, DRV-115) atau hari ini.
 */
export function workDateCheck(workDate: string, base: IsoDate, today: IsoDate, backdateDays: number): { problem: string | null; late: boolean } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { problem: 'Tanggal kerja tidak sah.', late: false };
  if (workDate > today) return { problem: 'Tanggal kerja tidak boleh sesudah hari ini.', late: false };
  return { problem: null, late: workDate < addDays(base, -backdateDays) };
}

/** Beda persen berat baru terhadap berat lama, 2 desimal (DRV-105). */
export function weightChangePercent(fromKg: string, toKg: string): string {
  const from = new Big(fromKg);
  if (from.eq(0)) return '100.00';
  return new Big(toKg).minus(from).abs().div(from).times(100).round(2, Big.roundHalfUp).toFixed(2);
}

export const weightFlagged = (fromKg: string | null, toKg: string, thresholdPercent: number) =>
  fromKg != null && new Big(weightChangePercent(fromKg, toKg)).gt(thresholdPercent);

/** Gram dari kasir → kg 3 desimal, sebagai saran isian berat (spec L8 §9 butir 3). */
export function gramsToKg(grams: number | null): string | null {
  if (grams == null || !Number.isFinite(grams) || grams <= 0) return null;
  return new Big(grams).div(1000).round(3, Big.roundHalfUp).toFixed(3);
}

/** Nomor laporan `LB-YYYYMMDD-urut` (spec v3 §3.3). */
export function reportNumber(workDate: IsoDate, sequence: number): string {
  return `LB-${workDate.replace(/-/g, '')}-${String(sequence).padStart(2, '0')}`;
}

/** PO kasir memakai jumlah bulat: barang produk kasir di bongkaran wajib bulat (spec 2026-11-06 §9 butir 1). */
export function isWholeQuantity(quantity: string): boolean {
  return new Big(quantity).mod(1).eq(0);
}

/** kg (3 desimal) → gram bulat untuk berat POS; kg HRIS 3 desimal = gram tanpa pembulatan. */
export function kgToGrams(kg: string): number {
  return Number(new Big(kg).times(1000).round(0, Big.roundHalfUp).toFixed(0));
}

/** Selisih jumlah dibongkar dengan sisa PO; null = baris di luar PO. */
export function poDifference(quantity: string, poQty: string | null): string | null {
  return poQty == null ? null : new Big(quantity).minus(poQty).toFixed(3);
}
