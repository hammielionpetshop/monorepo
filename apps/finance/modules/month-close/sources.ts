import type postgres from 'postgres';
import { balanceBoard, lastDayOfMonth, loadCashCounts, loadLines, loadPlaces, loadUnplaced } from '@/modules/money';
import {
  buildProfitLoss, loadBranches, loadCosts, loadFlags, loadInternalSales, loadSales, type Flag, type ProfitLoss,
} from '@/modules/profit-loss';
import { countOpenItems, type Closing, type MonthSnapshot, type OpenItem } from './rules';

/**
 * Pembaca & satu-satunya penulis web Finance (spec F2-6f §0 butir 1): `month_closings` diisi dengan transaksi
 * baca-tulis khusus; role `finance_app` hanya punya INSERT di tabel itu (packages/db-roles/src/roles.sql).
 */
type Sql = postgres.Sql;

async function hasTable(sql: Sql, name: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`select to_regclass(${name}) is not null as ok`;
  return Boolean(row?.ok);
}

type ClosingRow = {
  month: string; closed_at: Date; closed_by_name: string; with_notes: boolean; note: string | null;
  open_items: OpenItem[]; snapshot: MonthSnapshot;
};

/** Semua penutupan; DB tanpa tabelnya (migrasi 0070 belum masuk) = belum ada yang ditutup. */
export async function loadClosings(sql: Sql): Promise<Closing[]> {
  if (!(await hasTable(sql, 'petshop.month_closings'))) return [];
  const rows = await sql<ClosingRow[]>`
    select to_char(c.month, 'YYYY-MM') as month, c.closed_at, u.name as closed_by_name, c.with_notes, c.note, c.open_items, c.snapshot
    from petshop.month_closings c join petshop.users u on u.id = c.closed_by
    order by c.month`;
  return rows.map((r) => ({
    month: r.month, closedAt: new Date(r.closed_at).toISOString(), closedByName: r.closed_by_name, withNotes: r.with_notes, note: r.note,
    openItems: r.open_items ?? [], snapshot: r.snapshot,
  }));
}

/** Laba Rugi hidup satu bulan + tandanya (rumus yang sama dengan halaman Laba Rugi). */
export async function liveProfitLoss(sql: Sql, month: string): Promise<{ profitLoss: ProfitLoss; flags: Flag[] }> {
  const [branches, sales, costs] = await Promise.all([loadBranches(sql), loadSales(sql, month), loadCosts(sql, month)]);
  const [internalSales, flags] = await Promise.all([loadInternalSales(sql, month, sales), loadFlags(sql, month, costs)]);
  return { profitLoss: buildProfitLoss({ branches, sales, costs, internalSales }), flags };
}

/** Salinan yang disimpan saat menutup: Laba Rugi, tanda, dan saldo tiap Tempat Uang per akhir bulan. */
export async function buildSnapshot(sql: Sql, month: string): Promise<MonthSnapshot> {
  const end = lastDayOfMonth(`${month}-01`);
  const [{ profitLoss, flags }, places, lines] = await Promise.all([liveProfitLoss(sql, month), loadPlaces(sql), loadLines(sql, end)]);
  const board = balanceBoard(places, lines, end);
  return {
    version: 1,
    profitLoss,
    flags,
    balances: board.groups.flatMap((g) => g.rows.map((r) => ({ placeId: r.place.id, name: r.place.name, branchName: g.branchName, balance: r.balance }))),
    balanceTotal: board.total,
  };
}

/** Daftar belum beres sebuah bulan (tanda Laba Rugi + Hitung Kas akhir bulan + catatan tanpa Tempat Uang). */
export async function loadOpenItems(sql: Sql, month: string, flags: Flag[]): Promise<OpenItem[]> {
  const end = lastDayOfMonth(`${month}-01`);
  const [places, lines, counts, unplaced] = await Promise.all([loadPlaces(sql), loadLines(sql, end), loadCashCounts(sql, end), loadUnplaced(sql, end)]);
  return [
    ...flags.map((f) => ({ key: f.key, label: f.label, count: f.count, amount: f.amount })),
    ...countOpenItems(places, lines, counts, end),
    ...unplaced.filter((u) => u.count > 0).map((u) => ({ key: `unplaced-${u.key.toLowerCase()}`, label: u.label, count: u.count, amount: u.amount })),
  ];
}

/**
 * Simpan penutupan. Koneksi Finance memulai setiap transaksi baca saja, jadi di sini transaksi dibuka `read write`
 * secara tegas; database tetap menjaga urutan bulan, bulan sudah lewat, dan larangan ubah/hapus (trigger 0070).
 */
export async function insertClosing(sql: Sql, input: {
  month: string; userId: number; withNotes: boolean; note: string | null; openItems: OpenItem[]; snapshot: MonthSnapshot;
}): Promise<void> {
  await sql.begin('read write', async (tx) => {
    await tx`
      insert into petshop.month_closings (month, closed_by, with_notes, note, open_items, snapshot)
      values (${`${input.month}-01`}::date, ${input.userId}, ${input.withNotes}, ${input.note},
        ${tx.json(input.openItems as unknown as postgres.JSONValue)}, ${tx.json(input.snapshot as unknown as postgres.JSONValue)})`;
  });
}
