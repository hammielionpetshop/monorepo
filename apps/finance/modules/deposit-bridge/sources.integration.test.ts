import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { columnKey, value } from './rules';
import { loadBridge } from './sources';

// Jembatan Setoran bebas vs laba terhadap DB worktree lokal (spec F2-6c-2 §4.1). Data disiapkan sebagai pemilik DB,
// dibaca sebagai finance_app (baca saja). Dilewati bila FINANCE_TEST_ADMIN_URL / FINANCE_TEST_DATABASE_URL kosong.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const READER_URL = process.env.FINANCE_TEST_DATABASE_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL) || !local(READER_URL))('Pembaca Setoran bebas vs laba (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', { max: 1, onnotice: () => {} });
  const reader = postgres(READER_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    connection: { default_transaction_read_only: true },
  });
  const run = randomUUID().slice(0, 8);
  const ids = { shop: 0, hub: 0, shift: 0 };

  beforeAll(async () => {
    const branch = async (code: string, name: string) =>
      (await admin`insert into petshop.branches (code, name) values (${`${code}${run}`}, ${`${name} ${run}`}) returning id`)[0].id as number;
    ids.shop = await branch('JA', 'Toko Jembatan');
    ids.hub = await branch('JP', 'Gudang Jembatan');
    const [role] = await admin`insert into petshop.roles (name) values (${`JA${run}`}) returning id`;
    const [user] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`JA${run}`}, ${role.id}, ${ids.shop}) returning id`;
    const [uom] = await admin`insert into petshop.units_of_measure (code, name) values (${`J${run}`}, 'pcs') returning id`;
    const [prod] = await admin`insert into petshop.products (name, base_uom_id) values (${`Barang J ${run}`}, ${uom.id}) returning id`;
    const [cash] = await admin`insert into petshop.payment_methods (name, type) values (${`Tunai ${run}`}, 'CASH') returning id`;
    const [debt] = await admin`insert into petshop.payment_methods (name, type) values (${`Hutang ${run}`}, 'DEBT') returning id`;
    const [cust] = await admin`insert into petshop.customers (name) values (${`Pelanggan ${run}`}) returning id`;

    // Shift 10 Nov: tunai 1.000.000 − Pengeluaran Kasir 20.000 = kas 980.000, kas nyata sama.
    [{ id: ids.shift }] = await admin`insert into petshop.shifts
      (branch_id, opened_by_id, shift_number, assigned_cashiers, opening_cash, status, origin, opened_at, closed_at, total_closing_cash_real, total_closing_cash_expected, total_variance)
      values (${ids.shop}, ${user.id}, 1, '[]', 0, 'CLOSED', 'POS', '2026-11-10 01:00:00', '2026-11-10 10:00:00', 980000, 980000, 0) returning id`;
    const trx = async (no: string, amount: number, cogs: number, methodId: number, customerId: number | null) => {
      const [t] = await admin`insert into petshop.transactions (trx_number, branch_id, shift_id, cashier_id, customer_id, total_amount, payable_amount, paid_amount, change_amount, status, created_at)
        values (${`J${no}${run}`}, ${ids.shop}, ${ids.shift}, ${user.id}, ${customerId}, ${amount}, ${amount}, ${amount}, 0, 'COMPLETED', '2026-11-10 03:00:00') returning id`;
      await admin`insert into petshop.transaction_items (transaction_id, product_id, uom_id, qty, unit_price, total_price, price_tier, cogs)
        values (${t.id}, ${prod.id}, ${uom.id}, 10, ${amount / 10}, ${amount}, 'RETAIL', ${cogs})`;
      await admin`insert into petshop.transaction_payments (transaction_id, payment_method_id, amount) values (${t.id}, ${methodId}, ${amount})`;
      return t.id as number;
    };
    await trx('A', 1_000_000, 600_000, cash.id, null);
    const credit = await trx('B', 500_000, 300_000, debt.id, cust.id);
    await admin`insert into petshop.customer_debts (customer_id, transaction_id, branch_id, total_amount, paid_amount, remaining_amount, status)
      values (${cust.id}, ${credit}, ${ids.shop}, 500000, 0, 500000, 'UNPAID')`;

    // Pengeluaran Kasir 20.000 dipasangkan ke kategori Biaya.
    const [cat] = await admin`insert into petshop.cash_flow_categories (name, type, report_kind) values (${`Plastik ${run}`}, 'EXPENSE', 'COST') returning id`;
    const [ec] = await admin`insert into petshop.expense_categories (name, cash_flow_category_id) values (${`Plastik ${run}`}, ${cat.id}) returning id`;
    await admin`insert into petshop.shift_expenses (shift_id, cashier_id, category_id, amount, note, created_at)
      values (${ids.shift}, ${user.id}, ${ec.id}, 20000, 'kantong', '2026-11-10 05:00:00')`;

    // Setoran tunai 11 Nov ke rekening Finance 980.000: 300.000 melunasi utang ke Gudang (diteruskan, Gudang tidak berutang), sisa bebas.
    const [bank] = await admin`insert into petshop.money_places (name, kind, branch_id, bank_name, account_number, held_by)
      values (${`Rek J ${run}`}, 'BANK', ${ids.shop}, 'BCA', '1', 'FINANCE') returning id`;
    const [dep] = await admin`insert into petshop.cash_deposits
      (deposit_number, branch_id, destination_money_place_id, deposit_date, reported_amount, report_channel, reported_by, status, received_amount, verified_by, verified_at, verified_held_by)
      values (${`STN-J${run}`}, ${ids.shop}, ${bank.id}, '2026-11-11', 980000, 'BACKOFFICE', ${user.id}, 'VERIFIED', 980000, ${user.id}, now(), 'FINANCE') returning id`;
    await admin`insert into petshop.cash_deposit_shifts (deposit_id, shift_id, cash_amount) values (${dep.id}, ${ids.shift}, 980000)`;
    const [ibt] = await admin`insert into petshop.inter_branch_transfers (ibt_number, source_branch_id, destination_branch_id, requested_by_id, status)
      values (${`IBT-J${run}`}, ${ids.hub}, ${ids.shop}, ${user.id}, 'RECEIVED') returning id`;
    const [payable] = await admin`insert into petshop.inter_branch_payables (transfer_id, debtor_branch_id, creditor_branch_id, total_amount, paid_amount, status, created_at)
      values (${ibt.id}, ${ids.shop}, ${ids.hub}, 300000, 300000, 'PAID', '2026-11-09 03:00:00') returning id`;
    const [pay] = await admin`insert into petshop.inter_branch_payments (payable_id, amount, source_type, reference_number, paid_at)
      values (${payable.id}, 300000, 'SETORAN', ${`STN-J${run}`}, '2026-11-11 03:00:00') returning id`;
    const [lvl1] = await admin`insert into petshop.deposit_settlements (source_type, source_id, level, payer_branch_id, payable_id, payment_id, amount, created_by)
      values ('CASH_DEPOSIT', ${dep.id}, 1, ${ids.shop}, ${payable.id}, ${pay.id}, 300000, ${user.id}) returning id`;
    await admin`insert into petshop.deposit_settlements (source_type, source_id, level, parent_id, payer_branch_id, amount, created_by)
      values ('CASH_DEPOSIT', ${dep.id}, 2, ${lvl1.id}, ${ids.hub}, 300000, ${user.id}),
             ('CASH_DEPOSIT', ${dep.id}, 1, null, ${ids.shop}, 680000, ${user.id})`;
  });

  afterAll(async () => {
    await Promise.all([admin.end(), reader.end()]);
  });

  it('nota tunai, nota kredit, Pengeluaran Kasir, setoran ke Finance, utang internal dilunasi → selisih nol', async () => {
    const { bridge, items } = await loadBridge(reader, '2026-11');
    const shop = columnKey(ids.shop);
    const hub = columnKey(ids.hub);
    const line = (key: string, col: string) => value(bridge.lines.find((l) => l.key === key)?.values ?? {}, col);

    expect(value(bridge.net, shop)).toBe(580_000); // 1.500.000 − 900.000 − 20.000
    expect(value(bridge.free, shop)).toBe(680_000);
    expect(line('goods', shop)).toBe(900_000);
    expect(line('settled', shop)).toBe(-300_000);
    expect(line('cashier-costs', shop)).toBe(20_000);
    expect(line('receivables', shop)).toBe(-500_000);
    expect(line('cashier-expenses', shop)).toBe(-20_000);
    expect(line('cash-undeposited', shop)).toBe(0);
    expect(line('variances', shop)).toBe(0);
    expect(value(bridge.unexplained, shop)).toBe(0);

    expect(value(bridge.free, hub)).toBe(300_000);
    expect(line('received', hub)).toBe(300_000);
    expect(value(bridge.unexplained, hub)).toBe(0);

    expect(items.filter((i) => i.branchId === ids.shop && i.line === 'receivables').map((i) => i.amount)).toEqual([-500_000]);
  });

  it('shift dilepas dari setoran → tunai belum disetor dan selisih setoran saling menjelaskan', async () => {
    await admin`update petshop.cash_deposit_shifts set released_at = now() where shift_id = ${ids.shift}`;
    try {
      const { bridge } = await loadBridge(reader, '2026-11');
      const shop = columnKey(ids.shop);
      expect(value(bridge.lines.find((l) => l.key === 'cash-undeposited')!.values, shop)).toBe(-980_000);
      // Setoran tanpa shift aktif: seluruh uang diterima tampil sebagai selisih setoran (+980.000), jadi tetap terjelaskan.
      expect(value(bridge.lines.find((l) => l.key === 'variances')!.values, shop)).toBe(980_000);
      expect(value(bridge.unexplained, shop)).toBe(0);
    } finally {
      await admin`update petshop.cash_deposit_shifts set released_at = null where shift_id = ${ids.shift}`;
    }
  });

  it('finance_app ditolak menulis', async () => {
    await expect(reader`update petshop.cash_deposit_shifts set cash_amount = cash_amount where shift_id = ${ids.shift}`).rejects.toThrow();
  });
});
