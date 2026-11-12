import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countCheck } from './rules';
import { loadCashCounts, loadLines, loadPlaces } from './sources';

// Hitung Kas F2-6e-2 terhadap DB worktree lokal: hitungan & penyesuaian ditulis sebagai pemilik DB (seperti Back
// Office), dibaca sebagai finance_app. Dilewati bila FINANCE_TEST_ADMIN_URL / FINANCE_TEST_DATABASE_URL kosong.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const READER_URL = process.env.FINANCE_TEST_DATABASE_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL) || !local(READER_URL))('Hitung Kas di Finance (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', { max: 1, onnotice: () => {} });
  const reader = postgres(READER_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    connection: { default_transaction_read_only: true },
  });
  const run = randomUUID().slice(0, 8);
  let cash = 0;
  let userId = 0;
  let branchId = 0;
  let countId = 0;

  beforeAll(async () => {
    const [b] = await admin`insert into petshop.branches (code, name) values (${`HC${run}`}, ${`Toko HC ${run}`}) returning id`;
    branchId = b.id;
    const [role] = await admin`insert into petshop.roles (name) values (${`HC${run}`}) returning id`;
    [{ id: userId }] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`HC${run}`}, ${role.id}, ${b.id}) returning id`;
    [{ id: cash }] = await admin`insert into petshop.money_places (name, kind, branch_id, held_by)
      values (${`Brankas HC ${run}`}, 'CASH', ${b.id}, 'FINANCE') returning id`;
    await admin`insert into petshop.money_place_opening_balances (money_place_id, amount, created_by) values (${cash}, 5000000, ${userId})`;
    [{ id: countId }] = await admin`insert into petshop.cash_counts (money_place_id, counted_on, amount, created_by)
      values (${cash}, '2026-11-05', 4950000, ${userId}) returning id`;
    // Hitungan batal tidak dibaca.
    await admin`insert into petshop.cash_counts (money_place_id, counted_on, amount, created_by, cancelled_at, cancelled_by, cancel_reason)
      values (${cash}, '2026-11-06', 1, ${userId}, now(), ${userId}, 'salah ketik')`;
  });

  afterAll(async () => {
    await Promise.all([admin.end(), reader.end()]);
  });

  it('selisih kurang terbaca, lalu cocok sesudah penyesuaian "Selisih kas kurang"', async () => {
    const place = (await loadPlaces(reader)).find((p) => p.id === cash)!;
    let counts = (await loadCashCounts(reader, '2026-11-30')).filter((c) => c.placeId === cash);
    expect(counts.map((c) => c.id)).toEqual([countId]);
    expect(countCheck(place, await loadLines(reader, '2026-11-30'), counts[0])).toMatchObject({ systemBalance: 5_000_000, variance: -50_000 });

    const [cat] = await admin`select id from petshop.cash_flow_categories where name = 'Selisih kas kurang' and type = 'EXPENSE'`;
    const [entry] = await admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, money_place_id, created_by)
      values ('EXPENSE', ${cat.id}, ${branchId}, 50000, '2026-11-05', '2026-11-01', ${cash}, ${userId}) returning id`;
    await admin`update petshop.cash_counts set adjustment_cash_flow_entry_id = ${entry.id} where id = ${countId}`;

    counts = (await loadCashCounts(reader, '2026-11-30')).filter((c) => c.placeId === cash);
    expect(counts[0].adjustment).toEqual({ direction: 'SHORT', amount: 50_000 });
    expect(countCheck(place, await loadLines(reader, '2026-11-30'), counts[0]).variance).toBe(0);
  });
});
