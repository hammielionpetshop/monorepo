import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadCosts } from './sources';

// Aset di Laba Rugi F2-6d-2 terhadap DB worktree lokal: data disiapkan sebagai pemilik DB, dibaca sebagai finance_app
// (SET ROLE, baca saja). Dilewati bila FINANCE_TEST_ADMIN_URL kosong / bukan DB worktree.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL))('Aset di Laba Rugi (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    onnotice: () => {},
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
  });
  const run = randomUUID().slice(0, 8);
  let shop = 0;
  const ids: number[] = [];

  beforeAll(async () => {
    const [b] = await admin`insert into petshop.branches (code, name) values (${`FA${run}`}, ${`Toko FA ${run}`}) returning id`;
    shop = b.id;
    const [role] = await admin`insert into petshop.roles (name) values (${`FA${run}`}) returning id`;
    const [user] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`FA${run}`}, ${role.id}, ${shop}) returning id`;
    const [cat] = await admin`select id from petshop.cash_flow_categories where name = 'Beli aset' and type = 'EXPENSE'`;
    const asset = async (name: string, price: number, life: number, on: string, extra: Record<string, unknown> = {}) => {
      const [e] = await admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, created_by)
        values ('EXPENSE', ${cat.id}, ${shop}, ${price}, ${on}, date_trunc('month', ${on}::date)::date, ${user.id}) returning id`;
      const [a] = await admin`insert into petshop.fixed_assets (name, asset_type, branch_id, purchase_price, purchased_on, useful_life_months, purchase_cash_flow_entry_id, created_by)
        values (${`${name} ${run}`}, 'MACHINE', ${shop}, ${price}, ${on}, ${life}, ${e.id}, ${user.id}) returning id`;
      if (Object.keys(extra).length) await admin`update petshop.fixed_assets set ${admin(extra)} where id = ${a.id}`;
      ids.push(a.id);
      return a.id;
    };
    await asset('Freezer', 7_500_000, 48, '2026-11-10');
    await asset('Timbangan', 1_500_000, 12, '2026-11-03', {
      status: 'SOLD', disposed_on: '2026-11-20', disposal_reason: 'dijual', sale_amount: 1_000_000, disposed_by: user.id, disposed_at: new Date(),
    });
    const cancelled = await asset('Salah', 2_000_000, 24, '2026-11-05');
    await admin`update petshop.fixed_assets set cancelled_at = now(), cancelled_by = ${user.id}, cancel_reason = 'salah catat' where id = ${cancelled}`;
  });

  afterAll(async () => {
    await admin.end();
  });

  it('penyusutan & kerugian aset dibaca sebagai finance_app; aset batal dan Beli aset tidak dihitung', async () => {
    const costs = await admin.begin(async (tx) => {
      await tx`set local role finance_app`;
      return loadCosts(tx as unknown as postgres.Sql, '2026-11');
    });
    const mine = costs.filter((c) => c.branchId === shop);
    expect(mine.filter((c) => c.group === 'DEPRECIATION').map((c) => c.amount)).toEqual([156_250]);
    // Timbangan dijual di bulan beli: sisa nilai 1.500.000 − 1.000.000.
    expect(mine.filter((c) => c.group === 'ASSET_LOSS').map((c) => [c.kind, c.amount])).toEqual([['COST', 500_000]]);
    expect(mine.filter((c) => c.group === 'CATEGORY')).toEqual([]);
  });
});
