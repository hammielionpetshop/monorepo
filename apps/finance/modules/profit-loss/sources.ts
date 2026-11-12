import type postgres from 'postgres';
import { monthRange, payslipMonth, type CostItem, type SalesRow } from './rules';

/**
 * Pintu baca Laba Rugi F2-6b (spec §1, §3). Tabel yang dibaca di sini = daftar SELECT role `finance_app`
 * (packages/db-roles/src/roles.sql). Batal/void tidak dibaca.
 */

type Sql = postgres.Sql;

async function hasTable(sql: Sql, name: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`select to_regclass(${name}) is not null as ok`;
  return Boolean(row?.ok);
}

const wib = (col: string) => `(${col} at time zone 'UTC' at time zone 'Asia/Jakarta')::date`;

export type BranchRow = { id: number; name: string; isActive: boolean };

export async function loadBranches(sql: Sql): Promise<BranchRow[]> {
  const rows = await sql<{ id: number; name: string; is_active: boolean }[]>`select id, name, is_active from petshop.branches order by name`;
  return rows.map((r) => ({ id: Number(r.id), name: r.name, isActive: r.is_active }));
}

/**
 * Penjualan s.d. Penyesuaian Modal per cabang — SALINAN rumus BO `getProfitLossReport`
 * (apps/backoffice/lib/services/report-service.ts) dan `getInternalReturnPLAdjustments`
 * (internal-return-report.ts). Bila rumus BO berubah, ubah juga di sini (dijaga tes kesetaraan).
 */
export async function loadSales(sql: Sql, month: string): Promise<SalesRow[]> {
  const { from, to } = monthRange(month);
  const trxDate = sql.unsafe(wib('t.created_at'));
  const [sales, cogs, returns, damaged, revisions] = await Promise.all([
    sql<{ branch_id: number; amount: string }[]>`
      select t.branch_id, coalesce(sum(t.payable_amount), 0)::text as amount
      from petshop.transactions t
      where t.status = 'COMPLETED' and ${trxDate} between ${from}::date and ${to}::date
      group by t.branch_id`,
    sql<{ branch_id: number; amount: string }[]>`
      select t.branch_id, coalesce(sum(coalesce(ti.cogs, puc.cost_price * ti.qty, p.default_cost_price * ti.qty * coalesce(puv.ratio, 1), 0)), 0)::text as amount
      from petshop.transaction_items ti
      join petshop.transactions t on t.id = ti.transaction_id and t.status = 'COMPLETED' and ${trxDate} between ${from}::date and ${to}::date
      left join petshop.product_uom_costs puc on puc.product_id = ti.product_id and puc.branch_id = t.branch_id and puc.uom_id = ti.uom_id
      left join petshop.products p on p.id = ti.product_id
      left join petshop.product_uom_conversions puv on puv.product_id = ti.product_id and puv.uom_id = ti.uom_id
      group by t.branch_id`,
    sql<{ branch_id: number; amount: string; cogs: string }[]>`
      select t.branch_id, coalesce(sum(ri.refund_amount), 0)::text as amount,
        coalesce(round(sum(coalesce(
          ti.cogs::numeric * ri.qty / nullif(ti.qty, 0),
          ri.qty * (case when ti.uom_id = p.base_uom_id then 1 else coalesce(puv.ratio, 1) end) * coalesce(puc.cost_price, p.default_cost_price, 0)
        ))), 0)::text as cogs
      from petshop.return_items ri
      join petshop.returns r on r.id = ri.return_id
      join petshop.transactions t on t.id = r.transaction_id
      join petshop.transaction_items ti on ti.id = ri.transaction_item_id
      left join petshop.products p on p.id = ti.product_id
      left join petshop.product_uom_costs puc on puc.product_id = ti.product_id and puc.branch_id = t.branch_id and puc.uom_id = p.base_uom_id
      left join petshop.product_uom_conversions puv on puv.product_id = ti.product_id and puv.uom_id = ti.uom_id
      where r.cancelled_at is null and t.status = 'COMPLETED'
        and ${sql.unsafe(wib('r.created_at'))} between ${from}::date and ${to}::date
      group by t.branch_id`,
    sql<{ branch_id: number; amount: string }[]>`
      select d.branch_id, coalesce(sum(d.total_loss_value), 0)::text as amount
      from petshop.damaged_goods d
      where d.status = 'APPROVED' and ${sql.unsafe(wib('coalesce(d.resolved_at, d.reported_at)'))} between ${from}::date and ${to}::date
      group by d.branch_id`,
    sql<{ branch_id: number; revenue: string; cost: string }[]>`
      select branch_id, sum(revenue_correction)::text as revenue, sum(cost_adjustment)::text as cost
      from (
        select ir.sender_branch_id as branch_id, ir.total_value as revenue_correction, 0 as cost_adjustment
        from petshop.internal_returns ir
        where ir.kind = 'REVISI_HARGA' and ir.status = 'APPROVED' and ${sql.unsafe(wib('ir.resolved_at'))} between ${from}::date and ${to}::date
        union all
        select ir.receiver_branch_id, 0, ir.cogs_adjustment
        from petshop.internal_returns ir
        where ir.kind = 'REVISI_HARGA' and ir.status = 'APPROVED' and ${sql.unsafe(wib('ir.resolved_at'))} between ${from}::date and ${to}::date
        union all
        select ir.sender_branch_id, iri.line_value - iri.qty * ibti.cost_price_at_transfer, 0
        from petshop.internal_return_items iri
        join petshop.internal_returns ir on ir.id = iri.internal_return_id
        join petshop.inter_branch_transfer_items ibti on ibti.id = iri.transfer_item_id
        where ir.kind = 'BARANG_DIKEMBALIKAN' and ir.status = 'APPROVED' and ${sql.unsafe(wib('ir.resolved_at'))} between ${from}::date and ${to}::date
          and iri.line_value <> iri.qty * ibti.cost_price_at_transfer
      ) adj
      group by branch_id`,
  ]);

  const rows = new Map<number, SalesRow>();
  const get = (id: number) => {
    const key = Number(id);
    let r = rows.get(key);
    if (!r) {
      r = { branchId: key, sales: 0, returns: 0, revisionRevenue: 0, cogs: 0, returnCogs: 0, damaged: 0, costAdjustment: 0 };
      rows.set(key, r);
    }
    return r;
  };
  for (const r of sales) get(r.branch_id).sales = Number(r.amount);
  for (const r of cogs) get(r.branch_id).cogs = Number(r.amount);
  for (const r of returns) Object.assign(get(r.branch_id), { returns: Number(r.amount), returnCogs: Number(r.cogs) });
  for (const r of damaged) get(r.branch_id).damaged = Number(r.amount);
  for (const r of revisions) Object.assign(get(r.branch_id), { revisionRevenue: Number(r.revenue), costAdjustment: Number(r.cost) });
  return [...rows.values()];
}

/**
 * Penjualan ke cabang sendiri (§0 butir 7): nota ke pelanggan "cabang internal" dikurangi returnya, ditambah
 * koreksi Revisi Harga Beli/Barang Dikembalikan (semuanya penjualan internal). Dikeluarkan dari Gabungan.
 */
export async function loadInternalSales(sql: Sql, month: string, sales: SalesRow[]): Promise<number> {
  const { from, to } = monthRange(month);
  const [row] = await sql<{ sales: string; returns: string }[]>`
    select
      (select coalesce(sum(t.payable_amount), 0) from petshop.transactions t
        join petshop.customers c on c.id = t.customer_id and c.is_internal_branch
        where t.status = 'COMPLETED' and ${sql.unsafe(wib('t.created_at'))} between ${from}::date and ${to}::date)::text as sales,
      (select coalesce(sum(ri.refund_amount), 0) from petshop.return_items ri
        join petshop.returns r on r.id = ri.return_id
        join petshop.transactions t on t.id = r.transaction_id and t.status = 'COMPLETED'
        join petshop.customers c on c.id = t.customer_id and c.is_internal_branch
        where r.cancelled_at is null and ${sql.unsafe(wib('r.created_at'))} between ${from}::date and ${to}::date)::text as returns`;
  const revision = sales.reduce((s, r) => s + r.revisionRevenue, 0);
  return Number(row.sales) - Number(row.returns) - revision;
}

type ItemRow = {
  branch_id: number | null; grp: CostItem['group']; kind: CostItem['kind']; category: string | null; amount: number;
  date: string; label: string; source: CostItem['source']; ref: string; unpaid?: boolean;
};

const toItem = (r: ItemRow): CostItem => ({
  branchId: r.branch_id == null ? null : Number(r.branch_id), group: r.grp, kind: r.kind, category: r.category,
  amount: Number(r.amount), date: r.date, label: r.label, source: r.source, ref: r.ref, unpaidBill: Boolean(r.unpaid),
});

/** Back Office: Arus Kas jenis Biaya/Pendapatan lain, Pengeluaran Kasir, Biaya Rutin belum dibayar. */
async function backofficeItems(sql: Sql, month: string): Promise<ItemRow[]> {
  const { from, to } = monthRange(month);
  const rows = await sql<ItemRow[]>`
    select e.branch_id, 'CATEGORY' as grp, case c.report_kind when 'COST' then 'COST' else 'INCOME' end as kind,
      c.name as category, e.amount, to_char(e.occurred_on, 'YYYY-MM-DD') as date,
      c.name || ' — ' || coalesce(b.name, 'Bersama') || coalesce(': ' || nullif(e.note, ''), '') as label,
      'BO' as source, 'cf:' || e.id as ref
    from petshop.cash_flow_entries e
    join petshop.cash_flow_categories c on c.id = e.category_id
    left join petshop.branches b on b.id = e.branch_id
    where e.cancelled_at is null and c.report_kind in ('COST', 'INCOME')
      and ((c.report_kind = 'COST' and e.type = 'EXPENSE') or (c.report_kind = 'INCOME' and e.type = 'INCOME'))
      and e.for_month = ${from}::date

    union all
    select s.branch_id, 'CATEGORY', 'COST', c.name, x.amount, to_char(${sql.unsafe(wib('x.created_at'))}, 'YYYY-MM-DD'),
      'Pengeluaran Kasir ' || b.name || ' shift ' || s.shift_number || ': ' || x.note, 'BO', 'se:' || x.id
    from petshop.shift_expenses x
    join petshop.shifts s on s.id = x.shift_id
    join petshop.branches b on b.id = s.branch_id
    join petshop.expense_categories ec on ec.id = x.category_id
    join petshop.cash_flow_categories c on c.id = ec.cash_flow_category_id and c.report_kind = 'COST'
    where ${sql.unsafe(wib('x.created_at'))} between ${from}::date and ${to}::date`;
  if (!(await hasTable(sql, 'petshop.recurring_costs'))) return rows;
  // Tagihan Biaya Rutin bulan ini yang belum dibayar: jumlah berlaku terakhir ≤ bulan (rumus BO recurring-cost-rules).
  const unpaid = await sql<ItemRow[]>`
    select rc.branch_id, 'CATEGORY' as grp, 'COST' as kind, c.name as category, amt.amount, ${from} as date,
      rc.name || ' — ' || coalesce(b.name, 'Bersama') || ' (belum dibayar)' as label, 'BO' as source, 'rc:' || rc.id as ref, true as unpaid
    from petshop.recurring_costs rc
    join petshop.cash_flow_categories c on c.id = rc.category_id
    left join petshop.branches b on b.id = rc.branch_id
    join lateral (
      select a.amount from petshop.recurring_cost_amounts a
      where a.recurring_cost_id = rc.id and a.effective_month <= ${from}::date
      order by a.effective_month desc limit 1
    ) amt on true
    where rc.is_active and rc.start_month <= ${from}::date and (rc.end_month is null or rc.end_month >= ${from}::date)
      and not exists (
        select 1 from petshop.recurring_cost_payments p
        where p.recurring_cost_id = rc.id and p.for_month = ${from}::date and p.cancelled_at is null)`;
  return [...rows, ...unpaid];
}

/** HRIS: gaji (slip ditutup, pendapatan) dan bongkaran (laporan aktif/dibayar). Cabang HRIS → cabang kasir; tanpa = Kantor. */
async function hrisItems(sql: Sql, month: string): Promise<ItemRow[]> {
  if (!(await hasTable(sql, 'hris.payslips'))) return [];
  const { from, to } = monthRange(month);
  // Slip bulanan periode 26 bulan lalu; slip mingguan yang hari terakhirnya di bulan ini (dipilih longgar lalu disaring payslipMonth).
  const slips = await sql<{ id: number; kind: string; period_start: string; period_end: string | null; income: number; kasir_branch_id: number | null; name: string; branch_name: string | null }[]>`
    select ps.id, ps.kind, ps.period_start, ps.period_end, ps.income, hb.kasir_branch_id, e.name, ps.branch_name
    from hris.payslips ps
    join hris.employees e on e.id = ps.employee_id
    left join hris.branches hb on hb.id = ps.branch_id
    where ps.status = 'CLOSED' and coalesce(ps.period_end, ps.period_start) between (${from}::date - 40) and ${to}::date`;
  const target = month;
  const payroll: ItemRow[] = slips
    .filter((s) => payslipMonth(s.kind, s.period_start, s.period_end) === target)
    .map((s) => ({
      branch_id: s.kasir_branch_id, grp: 'PAYROLL', kind: 'COST', category: null, amount: Number(s.income ?? 0),
      date: s.period_end ?? s.period_start,
      label: `Gaji ${s.name} — ${s.kind === 'MONTHLY' ? 'bulanan' : 'mingguan'} ${s.period_start}${s.period_end ? ` s.d. ${s.period_end}` : ''}${s.branch_name ? ` (${s.branch_name})` : ''}`,
      source: 'HRIS', ref: `ps:${s.id}`,
    }));
  const unloading = await sql<ItemRow[]>`
    select hb.kasir_branch_id as branch_id, 'UNLOADING' as grp, 'COST' as kind, null as category, u.total_pay as amount,
      to_char(u.work_date, 'YYYY-MM-DD') as date, 'Bongkaran ' || u.number || ' — ' || u.supplier_name as label,
      'HRIS' as source, 'ur:' || u.id as ref
    from hris.unloading_reports u
    left join hris.branches hb on hb.id = u.cost_branch_id
    where u.status in ('ACTIVE', 'PAID') and u.work_date between ${from}::date and ${to}::date`;
  return [...payroll, ...unloading];
}

/** Logistik: bensin (cabang yang dibebani) dan sewa mobil (cabang garasi) — §0 butir 4, 6. */
async function logisticsItems(sql: Sql, month: string): Promise<ItemRow[]> {
  const { from, to } = monthRange(month);
  const out: ItemRow[] = [];
  if (await hasTable(sql, 'logistics.fuel_expenses')) {
    // View pintu baca Logistik: hanya pengisian yang berlaku (tanpa diganti/batal).
    out.push(...(await sql<ItemRow[]>`
      select hb.kasir_branch_id as branch_id, 'FUEL' as grp, 'COST' as kind, null as category, f.amount,
        to_char(f.filled_on, 'YYYY-MM-DD') as date, 'Bensin ' || f.vehicle_name || ' ' || f.vehicle_plate as label,
        'LOGISTIK' as source, 'ff:' || f.id as ref
      from logistics.fuel_expenses f
      left join hris.branches hb on hb.id = f.charge_branch_id
      where f.filled_on between ${from}::date and ${to}::date`));
  }
  if (await hasTable(sql, 'logistics.vehicle_rental_payments')) {
    out.push(...(await sql<ItemRow[]>`
      select hb.kasir_branch_id as branch_id, 'VEHICLE_RENTAL' as grp, 'COST' as kind, null as category, p.amount,
        to_char(p.occurred_on, 'YYYY-MM-DD') as date,
        'Sewa mobil ' || coalesce(v.name, '') || ' ' || p.trip_count || ' ritase' || case when p.kind = 'TOP_UP' then ' (susulan)' else '' end as label,
        'LOGISTIK' as source, 'vr:' || p.id as ref
      from logistics.vehicle_rental_payments p
      left join logistics.vehicles v on v.id = p.vehicle_id
      left join logistics.config cfg on cfg.id = 1
      left join hris.branches hb on hb.id = cfg.garage_branch_id
      where p.cancelled_at is null and p.for_month = ${from}::date`));
  }
  return out;
}

export async function loadCosts(sql: Sql, month: string): Promise<CostItem[]> {
  const [bo, hris, logistics] = await Promise.all([backofficeItems(sql, month), hrisItems(sql, month), logisticsItems(sql, month)]);
  return [...bo, ...hris, ...logistics].map(toItem);
}

export type Flag = { key: string; label: string; count: number; amount: number | null };

/** Tanda di atas tabel (§2): hal yang membuat laba belum final atau belum lengkap. */
export async function loadFlags(sql: Sql, month: string, costs: CostItem[]): Promise<Flag[]> {
  const { from, to } = monthRange(month);
  const flags: Flag[] = [];
  const unpaid = costs.filter((c) => c.unpaidBill);
  if (unpaid.length) {
    flags.push({ key: 'unpaid-bills', label: 'Biaya Rutin belum dibayar (dihitung sebesar tagihan)', count: unpaid.length, amount: unpaid.reduce((s, c) => s + c.amount, 0) });
  }
  const [unknown] = await sql<{ count: number; amount: string }[]>`
    select count(*)::int as count, coalesce(sum(amount), 0)::text as amount from (
      select e.amount from petshop.cash_flow_entries e join petshop.cash_flow_categories c on c.id = e.category_id
      where e.cancelled_at is null and c.report_kind is null and e.for_month = ${from}::date
      union all
      select x.amount from petshop.shift_expenses x
      left join petshop.expense_categories ec on ec.id = x.category_id
      left join petshop.cash_flow_categories c on c.id = ec.cash_flow_category_id
      where c.report_kind is null and ${sql.unsafe(wib('x.created_at'))} between ${from}::date and ${to}::date
    ) u`;
  if (unknown.count) flags.push({ key: 'unknown-kind', label: 'Catatan "belum jelas jenisnya" (kategori tanpa jenis laporan / Pengeluaran Kasir belum dipasangkan) — tidak dihitung', count: unknown.count, amount: Number(unknown.amount) });

  if (await hasTable(sql, 'hris.payslips')) {
    // Slip bulanan periode bulan ini (26 bulan lalu) yang masih Perkiraan.
    const prev = new Date(`${from}T00:00:00Z`);
    prev.setUTCMonth(prev.getUTCMonth() - 1);
    const periodStart = `${prev.toISOString().slice(0, 7)}-26`;
    const [open] = await sql<{ count: number }[]>`
      select count(*)::int as count from hris.payslips where kind = 'MONTHLY' and status = 'ESTIMATE' and period_start = ${periodStart}::date`;
    if (open.count) flags.push({ key: 'open-slips', label: 'Slip gaji bulan ini belum ditutup — laba belum final', count: open.count, amount: null });
  }
  const noBranch = costs.filter((c) => c.group === 'FUEL' && c.branchId == null);
  if (noBranch.length) flags.push({ key: 'fuel-no-branch', label: 'Bensin tanpa cabang yang dibebani (masuk Kantor)', count: noBranch.length, amount: noBranch.reduce((s, c) => s + c.amount, 0) });

  if (await hasTable(sql, 'logistics.vehicle_rental_payments')) {
    // Mobil sewa dengan trip Selesai bulan ini tetapi belum ada pembayaran sewa (§0 butir 6).
    const [rent] = await sql<{ count: number }[]>`
      select count(distinct t.vehicle_id)::int as count
      from logistics.trips t join logistics.vehicles v on v.id = t.vehicle_id and v.ownership = 'RENTED'
      where t.status = 'DONE' and t.trip_date between ${from}::date and ${to}::date
        and not exists (select 1 from logistics.vehicle_rental_payments p
          where p.vehicle_id = t.vehicle_id and p.for_month = ${from}::date and p.cancelled_at is null)`;
    if (rent.count) flags.push({ key: 'rental-unpaid', label: 'Mobil sewa ada ritase, sewanya belum dibayar (belum dihitung)', count: rent.count, amount: null });
  }
  return flags;
}
