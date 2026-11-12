import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildProfitLoss, cell, columnKey, OFFICE_KEY } from './rules';
import { loadBranches, loadCosts, loadFlags, loadInternalSales, loadSales } from './sources';

// Pembaca Laba Rugi terhadap DB worktree lokal (spec F2-6b §3.1). Data disiapkan sebagai pemilik DB, dibaca sebagai
// finance_app (baca saja). Dilewati bila FINANCE_TEST_ADMIN_URL / FINANCE_TEST_DATABASE_URL kosong.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const READER_URL = process.env.FINANCE_TEST_DATABASE_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL) || !local(READER_URL))('Pembaca Laba Rugi (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', { max: 1, onnotice: () => {} });
  const reader = postgres(READER_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    connection: { default_transaction_read_only: true },
  });
  const run = randomUUID().slice(0, 8);
  const month = '2026-11';
  let shop = 0;
  let store = 0;
  const mine = new Set<string>();

  beforeAll(async () => {
    const [b] = await admin`insert into petshop.branches (code, name) values (${`LR${run}`}, ${`Toko LR ${run}`}) returning id`;
    shop = b.id;
    const [b2] = await admin`insert into petshop.branches (code, name) values (${`LS${run}`}, ${`Toko Beli ${run}`}) returning id`;
    store = b2.id;
    const [role] = await admin`insert into petshop.roles (name) values (${`LR${run}`}) returning id`;
    const [user] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`LR${run}`}, ${role.id}, ${shop}) returning id`;
    const [uom] = await admin`insert into petshop.units_of_measure (code, name) values (${`U${run}`}, 'pcs') returning id`;
    const [prod] = await admin`insert into petshop.products (name, base_uom_id) values (${`Barang ${run}`}, ${uom.id}) returning id`;
    const [shift] = await admin`insert into petshop.shifts (branch_id, opened_by_id, shift_number, assigned_cashiers, opening_cash)
      values (${shop}, ${user.id}, 1, '[]', 0) returning id`;
    const [internal] = await admin`insert into petshop.customers (name, is_internal_branch, linked_branch_id) values (${`Cabang ${run}`}, true, ${store}) returning id`;

    // Nota umum Rp1.000.000 (HPP 600.000) + nota ke cabang sendiri Rp400.000 (HPP 300.000) + nota VOID (tidak dihitung).
    const trx = async (no: string, amount: number, cogs: number, customerId: number | null, status = 'COMPLETED') => {
      const [t] = await admin`insert into petshop.transactions (trx_number, branch_id, shift_id, cashier_id, customer_id, total_amount, payable_amount, paid_amount, change_amount, status, created_at)
        values (${`${no}${run}`}, ${shop}, ${shift.id}, ${user.id}, ${customerId}, ${amount}, ${amount}, ${amount}, 0, ${status}, '2026-11-10 03:00:00') returning id`;
      const [ti] = await admin`insert into petshop.transaction_items (transaction_id, product_id, uom_id, qty, unit_price, total_price, price_tier, cogs)
        values (${t.id}, ${prod.id}, ${uom.id}, 10, ${amount / 10}, ${amount}, 'RETAIL', ${cogs}) returning id`;
      return { t: t.id, ti: ti.id };
    };
    const sale = await trx('A', 1_000_000, 600_000, null);
    await trx('B', 400_000, 300_000, internal.id);
    await trx('C', 50_000, 10_000, null, 'VOIDED');
    // Retur 2 dari 10 barang nota A: omzet −200.000, HPP −120.000.
    const [ret] = await admin`insert into petshop.returns (return_number, transaction_id, branch_id, processed_by_id, reason, total_refund_amount, created_at)
      values (${`R${run}`}, ${sale.t}, ${shop}, ${user.id}, 'rusak', 200000, '2026-11-12 03:00:00') returning id`;
    await admin`insert into petshop.return_items (return_id, transaction_item_id, product_id, uom_id, qty, unit_price, cogs, refund_amount)
      values (${ret.id}, ${sale.ti}, ${prod.id}, ${uom.id}, 2, 100000, 600000, 200000)`;
    await admin`insert into petshop.damaged_goods (branch_id, reported_by_id, reason, total_loss_value, status, resolved_at)
      values (${shop}, ${user.id}, 'RUSAK', 25000, 'APPROVED', '2026-11-15 03:00:00')`;

    // Arus Kas: biaya cabang, biaya Bersama, pendapatan lain, batal, bulan lain, kategori belum jelas.
    const cat = async (name: string, type: string, kind: string | null) =>
      (await admin`insert into petshop.cash_flow_categories (name, type, report_kind) values (${`${name} ${run}`}, ${type}, ${kind}) returning id`)[0].id;
    const listrik = await cat('Listrik', 'EXPENSE', 'COST');
    const sewa = await cat('Sewa', 'EXPENSE', 'COST');
    const jasa = await cat('Jasa', 'INCOME', 'INCOME');
    const lama = await cat('Lama', 'EXPENSE', null);
    const entry = async (type: string, category: number, branch: number | null, amount: number, forMonth: string, cancelled = false) =>
      admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, created_by, cancelled_at, cancelled_by, cancel_reason)
        values (${type}, ${category}, ${branch}, ${amount}, '2026-11-05', ${forMonth}, ${user.id}, ${cancelled ? new Date() : null}, ${cancelled ? user.id : null}, ${cancelled ? 'salah' : null})`;
    await entry('EXPENSE', listrik, shop, 300_000, '2026-11-01');
    await entry('EXPENSE', listrik, shop, 999, '2026-11-01', true);
    await entry('EXPENSE', listrik, shop, 777, '2026-10-01');
    await entry('INCOME', jasa, shop, 50_000, '2026-11-01');
    await entry('EXPENSE', lama, shop, 1234, '2026-11-01');
    const [paidEntry] = await admin`insert into petshop.cash_flow_entries (type, category_id, branch_id, amount, occurred_on, for_month, created_by)
      values ('EXPENSE', ${sewa}, null, 2000000, '2026-11-02', '2026-11-01', ${user.id}) returning id`;

    // Pengeluaran Kasir dipasangkan ke Listrik.
    const [ec] = await admin`insert into petshop.expense_categories (name, cash_flow_category_id) values (${`Token ${run}`}, ${listrik}) returning id`;
    await admin`insert into petshop.shift_expenses (shift_id, cashier_id, category_id, amount, note, created_at)
      values (${shift.id}, ${user.id}, ${ec.id}, 20000, 'token listrik', '2026-11-08 03:00:00')`;

    // Biaya Rutin: Sewa Kantor sudah dibayar (Arus Kas di atas) + Sewa Toko belum dibayar.
    const rc = async (name: string, branch: number | null, amount: number) => {
      const [r] = await admin`insert into petshop.recurring_costs (name, category_id, branch_id, due_day, start_month, created_by)
        values (${`${name} ${run}`}, ${sewa}, ${branch}, 5, '2026-10-01', ${user.id}) returning id`;
      await admin`insert into petshop.recurring_cost_amounts (recurring_cost_id, amount, effective_month, created_by) values (${r.id}, ${amount}, '2026-10-01', ${user.id})`;
      return r.id;
    };
    const paidRc = await rc('Sewa Kantor', null, 2_000_000);
    await admin`insert into petshop.recurring_cost_payments (recurring_cost_id, for_month, billed_amount, amount, cash_flow_entry_id, batch_key, created_by)
      values (${paidRc}, '2026-11-01', 2000000, 2000000, ${paidEntry.id}, ${`k${run}`}, ${user.id})`;
    await rc('Sewa Toko', shop, 1_500_000);

    // HRIS: slip bulanan 26 Okt–25 Nov ditutup (November) + slip 26 Nov (Desember) + slip Perkiraan.
    const [hb] = await admin`insert into hris.branches (name, kasir_branch_id) values (${`Toko LR ${run}`}, ${shop}) returning id`;
    const [emp] = await admin`insert into hris.employees (code, name, joined_on) values (${`LR${run}`}, ${`Budi ${run}`}, '2026-01-01') returning id`;
    const slip = async (start: string, income: number, closed: boolean) => {
      const [s] = await admin`insert into hris.payslips (employee_id, period_start, kind, status, number, branch_id, income, net, closed_at, objection_until)
        values (${emp.id}, ${start}, 'MONTHLY', ${closed ? 'CLOSED' : 'ESTIMATE'}, ${closed ? `S${start}${run}` : null}, ${hb.id}, ${income}, ${closed ? income : null},
          ${closed ? new Date() : null}, ${closed ? new Date() : null}) returning id`;
      if (closed) mine.add(`ps:${s.id}`);
    };
    await slip('2026-10-26', 3_000_000, true);
    await slip('2026-11-26', 3_100_000, true);
    const [emp2] = await admin`insert into hris.employees (code, name, joined_on) values (${`LS${run}`}, ${`Ani ${run}`}, '2026-01-01') returning id`;
    await admin`insert into hris.payslips (employee_id, period_start, kind, status) values (${emp2.id}, '2026-10-26', 'MONTHLY', 'ESTIMATE')`;
  });

  afterAll(async () => {
    await Promise.all([admin.end(), reader.end()]);
  });

  it('penjualan setara BO: nota Selesai − retur bulan ini, HPP − HPP retur, barang rusak; nota VOID tidak dihitung', async () => {
    const sales = (await loadSales(reader, month)).find((s) => s.branchId === shop)!;
    expect(sales).toMatchObject({ sales: 1_400_000, returns: 200_000, cogs: 900_000, returnCogs: 120_000, damaged: 25_000, revisionRevenue: 0, costAdjustment: 0 });
    const all = await loadSales(reader, month);
    // Penjualan ke cabang sendiri dihitung dari semua cabang; minimal nota B ada di dalamnya.
    expect(await loadInternalSales(reader, month, all)).toBeGreaterThanOrEqual(400_000);
  });

  it('biaya per cabang yang menanggung, Kantor, pendapatan lain; batal/bulan lain/belum jelas tidak dihitung', async () => {
    const costs = await loadCosts(reader, month);
    const shopCosts = costs.filter((c) => c.branchId === shop);
    const byLabel = (group: string, category: string | null) =>
      shopCosts.filter((c) => c.group === group && (category == null || c.category === `${category} ${run}`)).reduce((s, c) => s + (c.kind === 'COST' ? c.amount : -c.amount), 0);
    expect(byLabel('CATEGORY', 'Listrik')).toBe(320_000); // Arus Kas 300.000 + Pengeluaran Kasir 20.000
    expect(byLabel('CATEGORY', 'Jasa')).toBe(-50_000);
    expect(byLabel('CATEGORY', 'Sewa')).toBe(1_500_000); // tagihan belum dibayar
    expect(shopCosts.find((c) => c.category === `Sewa ${run}`)?.unpaidBill).toBe(true);
    expect(byLabel('CATEGORY', 'Lama')).toBe(0);
    expect(byLabel('PAYROLL', null)).toBe(3_000_000); // hanya slip periode 26 Okt–25 Nov
    // Biaya Rutin Kantor yang sudah dibayar dihitung sekali (lewat Arus Kas), tidak sebagai tagihan.
    const office = costs.filter((c) => c.branchId == null && c.category === `Sewa ${run}`);
    expect(office.map((c) => [c.amount, Boolean(c.unpaidBill)])).toEqual([[2_000_000, false]]);
    expect(costs.filter((c) => c.group === 'PAYROLL' && mine.has(c.ref))).toHaveLength(1);

    const flags = await loadFlags(reader, month, costs);
    expect(flags.find((f) => f.key === 'open-slips')?.count).toBeGreaterThanOrEqual(1);
    expect(flags.find((f) => f.key === 'unknown-kind')?.amount).toBeGreaterThanOrEqual(1234);

    const pl = buildProfitLoss({
      branches: (await loadBranches(reader)).filter((b) => b.id === shop),
      sales: (await loadSales(reader, month)).filter((s) => s.branchId === shop),
      costs: costs.filter((c) => c.branchId === shop || office.includes(c)),
      internalSales: 400_000,
    });
    const net = pl.lines.find((l) => l.key === 'net')!;
    // (1.200.000 − 780.000) − 25.000 − (320.000 + 1.500.000 + 3.000.000) + 50.000
    expect(cell(net, columnKey(shop))).toBe(-4_375_000);
    expect(cell(net, OFFICE_KEY)).toBe(-2_000_000);
  });

  it('finance_app tetap ditolak menulis', async () => {
    await expect(reader`update petshop.transactions set status = status where branch_id = ${shop}`).rejects.toThrow();
    await expect(reader.unsafe('delete from hris.payslips where id = -1')).rejects.toThrow();
  });
});
