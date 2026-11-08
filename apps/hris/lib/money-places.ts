import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Tempat Uang (F2-1b, spec F2-1 §6): daftarnya milik Back Office (`petshop.money_places`), HRIS hanya
 * membaca lewat view `hris.pos_money_places`. Layar bayar HRIS menyebutnya "Sumber Uang".
 */
export type MoneyPlaceKind = 'DRAWER' | 'CASH' | 'BANK';
export type MoneyPlace = {
  id: number;
  name: string;
  kind: MoneyPlaceKind;
  branchId: number;
  branchName: string | null;
  heldBy: string;
  holderNote: string | null;
  active: boolean;
  sortOrder: number;
  /** 4 angka terakhir rekening (Rekening saja). */
  accountTail: string | null;
  /** Cara bayar turunan jenis: Laci/Tunai → CASH, Rekening → TRANSFER. */
  method: 'CASH' | 'TRANSFER';
};

type Executor = { execute: typeof db.execute };

type Row = {
  id: number; name: string; kind: MoneyPlaceKind; branch_id: number; branch_name: string | null; held_by: string; holder_note: string | null;
  active: boolean; sort_order: number; account_tail: string | null;
};

function toPlace(r: Row): MoneyPlace {
  return {
    id: Number(r.id), name: r.name, kind: r.kind, branchId: Number(r.branch_id), branchName: r.branch_name, heldBy: r.held_by, holderNote: r.holder_note,
    active: Boolean(r.active), sortOrder: Number(r.sort_order), accountTail: r.account_tail,
    method: r.kind === 'BANK' ? 'TRANSFER' : 'CASH',
  };
}

/**
 * Semua Tempat Uang (termasuk nonaktif & laci) untuk menampilkan catatan lama, atau `payable` = pilihan bayar baru:
 * aktif dan bukan Laci kasir. Isi laci dihitung shift POS; HRIS mengambil dari laci membuat tutup shift tidak cocok.
 */
export async function moneyPlaces(opts: { payable?: boolean } = {}, exec: Executor = db): Promise<MoneyPlace[]> {
  const rows = await exec.execute<Row>(sql`
    select m.id, m.name, m.kind, m.branch_id, b.name as branch_name, m.held_by, m.holder_note, m.active, m.sort_order, m.account_tail
    from hris.pos_money_places m left join hris.kasir_branches b on b.id = m.branch_id
    ${opts.payable ? sql`where m.active and m.kind <> 'DRAWER'` : sql``}
    order by m.sort_order, m.name`);
  return rows.map(toPlace);
}

/** Tempat Uang yang boleh dipakai membayar sekarang (aktif, bukan Laci), atau null. */
export async function payableMoneyPlace(id: unknown, exec: Executor = db): Promise<MoneyPlace | null> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const rows = await exec.execute<Row>(sql`
    select m.id, m.name, m.kind, m.branch_id, b.name as branch_name, m.held_by, m.holder_note, m.active, m.sort_order, m.account_tail
    from hris.pos_money_places m left join hris.kasir_branches b on b.id = m.branch_id where m.id = ${n} and m.active and m.kind <> 'DRAWER'`);
  return rows[0] ? toPlace(rows[0]) : null;
}

/** Satu Tempat Uang apa pun statusnya (untuk menampilkan catatan lama), atau null. */
export async function moneyPlaceById(id: number | null | undefined, exec: Executor = db): Promise<MoneyPlace | null> {
  if (!id) return null;
  const rows = await exec.execute<Row>(sql`
    select m.id, m.name, m.kind, m.branch_id, b.name as branch_name, m.held_by, m.holder_note, m.active, m.sort_order, m.account_tail
    from hris.pos_money_places m left join hris.kasir_branches b on b.id = m.branch_id where m.id = ${id}`);
  return rows[0] ? toPlace(rows[0]) : null;
}

export const MONEY_PLACE_KIND_LABELS: Record<MoneyPlaceKind, string> = { DRAWER: 'Laci kasir', CASH: 'Tunai', BANK: 'Rekening' };
export const MONEY_PLACE_HOLDER_LABELS: Record<string, string> = { FINANCE: 'Finance', STORE: 'Toko', OTHER: 'Lainnya' };
