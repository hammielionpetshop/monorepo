import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balanceBoard, flowReport } from './rules';
import { loadLines, loadPlaces, loadUnplaced } from './sources';

// Pembaca Finance terhadap DB worktree lokal (spec F2-6 §3.6). Data disiapkan sebagai pemilik DB, dibaca sebagai
// finance_app (baca saja). Dilewati bila FINANCE_TEST_ADMIN_URL / FINANCE_TEST_DATABASE_URL kosong.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const READER_URL = process.env.FINANCE_TEST_DATABASE_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL) || !local(READER_URL))('Pembaca Finance (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', { max: 1, onnotice: () => {} });
  const reader = postgres(READER_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    connection: { default_transaction_read_only: true },
  });
  const run = randomUUID().slice(0, 8);
  let bank = 0;
  let cash = 0;
  let branchName = '';

  beforeAll(async () => {
    const [b] = await admin`insert into petshop.branches (code, name) values (${`FN${run}`}, ${`Toko Fin ${run}`}) returning id, name`;
    branchName = b.name;
    const [role] = await admin`insert into petshop.roles (name) values (${`FN${run}`}) returning id`;
    const [user] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`FN${run}`}, ${role.id}, ${b.id}) returning id`;
    [{ id: bank }] = await admin`insert into petshop.money_places (name, kind, branch_id, bank_name, account_number, held_by)
      values (${`Rek Fin ${run}`}, 'BANK', ${b.id}, 'BCA', '123', 'FINANCE') returning id`;
    [{ id: cash }] = await admin`insert into petshop.money_places (name, kind, branch_id, held_by)
      values (${`Brankas Fin ${run}`}, 'CASH', ${b.id}, 'FINANCE') returning id`;
    await admin`insert into petshop.money_place_opening_balances (money_place_id, amount, created_by) values (${bank}, 10000000, ${user.id})`;
    const [cat] = await admin`insert into petshop.cash_flow_categories (name, type, report_kind) values (${`Listrik ${run}`}, 'EXPENSE', 'COST') returning id`;
    await admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, money_place_id, created_by)
      values ('EXPENSE', ${cat.id}, ${b.id}, 300000, '2026-11-05', '2026-11-01', ${bank}, ${user.id})`;
    // Batal: tidak dibaca.
    await admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, money_place_id, created_by, cancelled_at, cancelled_by, cancel_reason)
      values ('EXPENSE', ${cat.id}, ${b.id}, 999, '2026-11-05', '2026-11-01', ${bank}, ${user.id}, now(), ${user.id}, 'salah')`;
    // Tanpa Tempat Uang: masuk kotak "Belum masuk saldo".
    await admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, created_by)
      values ('EXPENSE', ${cat.id}, ${b.id}, 7000, '2026-11-06', '2026-11-01', ${user.id})`;
    const [tr] = await admin`insert into petshop.money_transfers (from_money_place_id, to_money_place_id, amount, occurred_on, created_by)
      values (${bank}, ${cash}, 2000000, '2026-11-07', ${user.id}) returning id`;
    await admin`insert into petshop.money_movements (from_money_place_id, to_money_place_id, amount, occurred_on, source_type, source_id, created_by)
      values (${bank}, ${cash}, 2000000, '2026-11-07', 'TRANSFER', ${tr.id}, ${user.id})`;
  });

  afterAll(async () => {
    await Promise.all([admin.end(), reader.end()]);
  });

  it('membaca saldo awal, Arus Kas, Pindah Dana; batal tidak dibaca; tanpa tempat dilaporkan terpisah', async () => {
    const places = (await loadPlaces(reader)).filter((p) => p.branchName === branchName);
    expect(places.map((p) => [p.kind, p.opening]).sort()).toEqual([['BANK', 10_000_000], ['CASH', null]].sort());
    const lines = await loadLines(reader, '2026-11-30');
    const mine = lines.filter((l) => l.placeId === bank || l.placeId === cash);
    expect(mine.map((l) => [l.kind, l.amount]).sort()).toEqual([
      ['CASHFLOW_OUT', -300_000], ['TRANSFER_IN', 2_000_000], ['TRANSFER_OUT', -2_000_000],
    ]);
    const board = balanceBoard(places, lines, '2026-11-30');
    expect(board.total).toBe(9_700_000);
    const flow = flowReport(places, lines, '2026-11-01');
    expect(flow).toMatchObject({ outTotal: 300_000, transferIn: 0, transferOut: 0, closing: 9_700_000 });
    const unplaced = await loadUnplaced(reader, '2026-11-30');
    expect(unplaced.find((u) => u.key === 'CASHFLOW')?.amount).toBeGreaterThanOrEqual(7000);
  });

  it('finance_app ditolak menulis', async () => {
    await expect(reader`update petshop.money_places set name = name where id = ${bank}`).rejects.toThrow();
    await expect(reader.unsafe('delete from petshop.cash_flow_entries where id = -1')).rejects.toThrow();
  });
});
