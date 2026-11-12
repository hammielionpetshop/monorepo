import Big from 'big.js';
import type postgres from 'postgres';
import { freeDeposits, loadSettlementPieces, type SettlementPiece } from '@/modules/inter-branch-debts';
import { loadPendingFunds, NONCASH_START } from '@/modules/pending-funds';
import {
  buildProfitLoss, cell, columnKey as plColumnKey, loadBranches, loadCosts, loadFlags, loadInternalSales, loadSales, monthRange,
  OFFICE_KEY, TOTAL_KEY as PL_TOTAL_KEY, type CostItem, type Flag, type SalesRow,
} from '@/modules/profit-loss';
import { buildBridge, type Bridge, type BranchBase, type BridgeItem } from './rules';

/**
 * Pintu baca jembatan Setoran bebas vs laba (spec F2-6c-2 §3). Laba Rugi (F2-6b), Setoran bebas (F2-6c-1) dan
 * Dana Belum Cair dipakai ulang; yang dibaca di sini hanya baris C (piutang, Pengeluaran Kasir, kas shift, setoran).
 * Rumus kas shift = BO `SHIFT_CASH` (apps/backoffice/lib/services/deposit-queries.ts); ubah keduanya bersamaan.
 * Tabel = daftar SELECT `finance_app` (packages/db-roles/src/roles.sql).
 */

type Sql = postgres.Sql;

const WIB_DATE = (col: string) => `(${col} at time zone 'UTC' at time zone 'Asia/Jakarta')::date`;
const WIB_TEXT = (col: string) => `to_char(${col} at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;
const SHIFT_CASH = `(case when s.origin = 'POS' and s.status = 'CLOSED' and s.total_closing_cash_real is not null
  then s.total_closing_cash_real else coalesce(s.total_closing_cash_expected, 0) end)`;
const CLOSED_ON = `(coalesce(s.closed_at, s.force_closed_at) at time zone 'UTC' at time zone 'Asia/Jakarta')::date`;

type Row = { branch_id: number | null; amount: number | string; date: string; label: string; ref: string };
const toItems = (line: BridgeItem['line'], rows: Row[], sign = 1): BridgeItem[] =>
  rows
    .map((r) => ({
      branchId: r.branch_id == null ? null : Number(r.branch_id), line, amount: sign * Number(r.amount),
      date: r.date, label: r.label, ref: r.ref,
    }))
    .filter((i) => i.amount !== 0);

/** A: harga pokok bersih, barang rusak, penyesuaian modal per cabang (angka Laba Rugi, bukan salinan rumus). */
function goodsItems(sales: SalesRow[], names: Map<number, string>, month: string): BridgeItem[] {
  const date = monthRange(month).from;
  return sales.flatMap((s) => {
    const name = names.get(s.branchId) ?? `Cabang ${s.branchId}`;
    const cogs = new Big(s.cogs).minus(s.returnCogs).toNumber();
    return [
      { branchId: s.branchId, line: 'goods' as const, amount: cogs, date, label: `Harga pokok ${name} (Laba Rugi)`, ref: 'pl:cogs' },
      { branchId: s.branchId, line: 'goods' as const, amount: s.damaged, date, label: `Barang rusak ${name} (Laba Rugi)`, ref: 'pl:damaged' },
      { branchId: s.branchId, line: 'goods' as const, amount: -s.costAdjustment, date, label: `Penyesuaian Modal ${name} (Laba Rugi)`, ref: 'pl:adjustment' },
    ].filter((i) => i.amount !== 0);
  });
}

/** B: biaya Laba Rugi dipisah Pengeluaran Kasir (ref `se:`) dan lainnya; pendapatan lain dikurangkan. */
function costItems(costs: CostItem[]): BridgeItem[] {
  return costs
    .filter((c) => c.amount !== 0)
    .map((c) => ({
      branchId: c.branchId,
      line: c.kind === 'INCOME' ? 'other-income' : c.ref.startsWith('se:') ? 'cashier-costs' : 'costs-elsewhere',
      amount: c.kind === 'INCOME' ? -c.amount : c.amount,
      date: c.date,
      label: c.label,
      ref: c.ref,
    }));
}

/** D dan A: potongan pelunasan otomatis bulan ini (tanggal uang setoran). */
function settlementItems(pieces: SettlementPiece[], month: string): BridgeItem[] {
  const out: BridgeItem[] = [];
  for (const p of pieces) {
    if (p.date.slice(0, 7) !== month || p.amount === 0) continue;
    const src = p.sourceRef ?? '';
    if (p.payableId != null) {
      out.push({ branchId: p.payerId, line: 'settled', amount: -p.amount, date: p.date, label: `Melunasi utang ke ${p.creditorName ?? '—'} dari ${src}${p.level > 1 ? ' (diteruskan)' : ''}`, ref: `ds:${src}` });
    }
    if (p.level > 1) {
      out.push({ branchId: p.payerId, line: 'received', amount: p.amount, date: p.date, label: `Diteruskan dari setoran ${src}`, ref: `ds:${src}` });
    } else if (p.sourceType === 'LEGACY_RUN') {
      out.push({ branchId: p.payerId, line: 'legacy', amount: p.amount, date: p.date, label: `Pelunasan susulan ${src}`, ref: `ds:${src}` });
    }
  }
  return out;
}

/** C: penjualan ke cabang lain per cabang penjual (nota − retur − koreksi Revisi Harga Beli). */
async function internalSalesItems(sql: Sql, month: string, sales: SalesRow[], names: Map<number, string>): Promise<BridgeItem[]> {
  const { from, to } = monthRange(month);
  const rows = await sql<Row[]>`
    select t.branch_id, -t.payable_amount as amount, ${sql.unsafe(WIB_TEXT('t.created_at'))} as date,
      'Nota ' || t.trx_number || ' ke ' || c.name as label, 'trx:' || t.id as ref
    from petshop.transactions t
    join petshop.customers c on c.id = t.customer_id and c.is_internal_branch
    where t.status = 'COMPLETED' and ${sql.unsafe(WIB_DATE('t.created_at'))} between ${from}::date and ${to}::date
    union all
    select t.branch_id, ri.refund_amount, ${sql.unsafe(WIB_TEXT('r.created_at'))},
      'Retur ' || r.return_number || ' nota ' || t.trx_number || ' (' || c.name || ')', 'ret:' || r.id || ':' || ri.id
    from petshop.return_items ri
    join petshop.returns r on r.id = ri.return_id
    join petshop.transactions t on t.id = r.transaction_id and t.status = 'COMPLETED'
    join petshop.customers c on c.id = t.customer_id and c.is_internal_branch
    where r.cancelled_at is null and ${sql.unsafe(WIB_DATE('r.created_at'))} between ${from}::date and ${to}::date`;
  const revisions: BridgeItem[] = sales
    .filter((s) => s.revisionRevenue !== 0)
    .map((s) => ({
      branchId: s.branchId, line: 'internal-sales', amount: s.revisionRevenue, date: from,
      label: `Koreksi omzet Revisi Harga Beli kiriman internal ${names.get(s.branchId) ?? ''} (sudah dikurangkan di Penjualan bersih)`, ref: 'pl:revision',
    }));
  return [...toItems('internal-sales', rows), ...revisions];
}

/** C: piutang pelanggan non-internal: nota kredit bulan ini (−) dan pelunasan piutang bulan ini (+). */
async function receivableItems(sql: Sql, month: string): Promise<BridgeItem[]> {
  const { from, to } = monthRange(month);
  const rows = await sql<Row[]>`
    select t.branch_id, -cd.total_amount as amount, ${sql.unsafe(WIB_TEXT('t.created_at'))} as date,
      'Nota kredit ' || t.trx_number || ' — ' || coalesce(c.name, 'pelanggan') as label, 'cd:' || cd.id as ref
    from petshop.customer_debts cd
    join petshop.transactions t on t.id = cd.transaction_id and t.status = 'COMPLETED'
    left join petshop.customers c on c.id = cd.customer_id
    where coalesce(c.is_internal_branch, false) = false
      and ${sql.unsafe(WIB_DATE('t.created_at'))} between ${from}::date and ${to}::date
    union all
    select coalesce(s.branch_id, dp.branch_id, cd.branch_id), dp.amount, ${sql.unsafe(WIB_TEXT('dp.created_at'))},
      'Pelunasan piutang ' || coalesce(t.trx_number, 'manual') || ' — ' || coalesce(c.name, 'pelanggan') || ' (' || pm.name || ')', 'dp:' || dp.id
    from petshop.debt_payments dp
    join petshop.customer_debts cd on cd.id = dp.debt_id
    join petshop.payment_methods pm on pm.id = dp.payment_method_id
    left join petshop.customers c on c.id = cd.customer_id
    left join petshop.transactions t on t.id = cd.transaction_id
    left join petshop.shifts s on s.id = dp.shift_id
    where dp.voided_at is null and coalesce(c.is_internal_branch, false) = false
      and ${sql.unsafe(WIB_DATE('dp.created_at'))} between ${from}::date and ${to}::date`;
  return toItems('receivables', rows);
}

/** C: semua Pengeluaran Kasir dari laci bulan ini (termasuk yang belum dipasangkan kategori). */
async function cashierExpenseItems(sql: Sql, month: string): Promise<BridgeItem[]> {
  const { from, to } = monthRange(month);
  const rows = await sql<Row[]>`
    select s.branch_id, -x.amount as amount, ${sql.unsafe(WIB_TEXT('x.created_at'))} as date,
      'Shift ' || s.shift_number || ': ' || coalesce(ec.name, x.category_custom, 'tanpa kategori') || ' — ' || x.note as label, 'se:' || x.id as ref
    from petshop.shift_expenses x
    join petshop.shifts s on s.id = x.shift_id
    left join petshop.expense_categories ec on ec.id = x.category_id
    where ${sql.unsafe(WIB_DATE('x.created_at'))} between ${from}::date and ${to}::date`;
  return toItems('cashier-expenses', rows);
}

/**
 * C: kas shift dan setoran tunai. Shift ditutup bulan ini yang tidak masuk setoran terverifikasi bertanggal bulan ini
 * (belum disetor / menunggu verifikasi / disetor bulan depan / diverifikasi cara lama), shift bulan lalu yang disetor
 * bulan ini, selisih kas shift, selisih setoran, dan setoran ke Tempat Uang yang tidak dipegang Finance.
 */
async function cashItems(sql: Sql, month: string): Promise<BridgeItem[]> {
  const { from, to } = monthRange(month);
  const [undeposited, prior, shiftVar, depositVar, nonFinance] = await Promise.all([
    sql<Row[]>`
      select s.branch_id, -${sql.unsafe(SHIFT_CASH)} as amount, ${sql.unsafe(CLOSED_ON)}::text as date,
        'Shift ' || s.shift_number || ' ditutup ' || ${sql.unsafe(CLOSED_ON)}::text || ' — ' ||
          case when dep.deposit_number is not null and dep.status = 'VERIFIED' then 'disetor ' || dep.deposit_date::text || ' (' || dep.deposit_number || ')'
            when dep.deposit_number is not null then 'menunggu verifikasi (' || dep.deposit_number || ')'
            when s.deposit_verified_at is not null then 'diverifikasi cara lama (di luar alur Setoran)'
            else 'belum disetor' end as label,
        'sh:' || s.id as ref
      from petshop.shifts s
      left join lateral (
        select cd.deposit_number, cd.status, cd.deposit_date from petshop.cash_deposit_shifts cds
        join petshop.cash_deposits cd on cd.id = cds.deposit_id
        where cds.shift_id = s.id and cds.released_at is null limit 1
      ) dep on true
      where s.status in ('CLOSED', 'FORCE_CLOSED') and ${sql.unsafe(CLOSED_ON)} between ${from}::date and ${to}::date
        and not (dep.status is not distinct from 'VERIFIED' and dep.deposit_date <= ${to}::date)`,
    sql<Row[]>`
      select s.branch_id, cds.cash_amount as amount, to_char(cd.deposit_date, 'YYYY-MM-DD') as date,
        'Shift ' || s.shift_number || ' ditutup ' || ${sql.unsafe(CLOSED_ON)}::text || ' disetor ' || cd.deposit_number as label, 'sh:' || s.id as ref
      from petshop.cash_deposit_shifts cds
      join petshop.cash_deposits cd on cd.id = cds.deposit_id and cd.status = 'VERIFIED'
      join petshop.shifts s on s.id = cds.shift_id
      where cds.released_at is null and cd.deposit_date between ${from}::date and ${to}::date
        and ${sql.unsafe(CLOSED_ON)} < ${from}::date`,
    sql<Row[]>`
      select s.branch_id, (s.total_closing_cash_real - s.total_closing_cash_expected) as amount, ${sql.unsafe(CLOSED_ON)}::text as date,
        'Selisih kas shift ' || s.shift_number || ' (nyata − seharusnya)' as label, 'shv:' || s.id as ref
      from petshop.shifts s
      where s.origin = 'POS' and s.status = 'CLOSED' and s.total_closing_cash_real is not null and s.total_closing_cash_expected is not null
        and ${sql.unsafe(CLOSED_ON)} between ${from}::date and ${to}::date`,
    sql<Row[]>`
      select cd.branch_id, coalesce(cd.received_amount, 0) - coalesce(sum(cds.cash_amount), 0) as amount,
        to_char(cd.deposit_date, 'YYYY-MM-DD') as date, 'Selisih setoran ' || cd.deposit_number || ' (diterima − kas shift)' as label,
        'cdv:' || cd.id as ref
      from petshop.cash_deposits cd
      left join petshop.cash_deposit_shifts cds on cds.deposit_id = cd.id and cds.released_at is null
      where cd.status = 'VERIFIED' and cd.deposit_date between ${from}::date and ${to}::date
      group by cd.id
      union all
      select v.branch_id, v.received_amount - v.expected_amount, to_char(v.business_date, 'YYYY-MM-DD'),
        'Selisih non-tunai NT-' || v.id || ' ' || pm.name || coalesce(' shift ' || s.shift_number, ''), 'ntv:' || v.id
      from petshop.noncash_verifications v
      join petshop.payment_methods pm on pm.id = v.payment_method_id
      left join petshop.shifts s on s.id = v.shift_id
      where v.superseded_at is null and v.status = 'VERIFIED' and v.received_amount is not null
        and v.business_date between ${from}::date and ${to}::date`,
    sql<Row[]>`
      select cd.branch_id, -cd.received_amount as amount, to_char(cd.deposit_date, 'YYYY-MM-DD') as date,
        'Setoran ' || cd.deposit_number || ' ke ' || mp.name as label, 'dep:' || cd.id as ref
      from petshop.cash_deposits cd
      join petshop.money_places mp on mp.id = cd.destination_money_place_id
      where cd.status = 'VERIFIED' and coalesce(cd.verified_held_by, mp.held_by) <> 'FINANCE'
        and cd.deposit_date between ${from}::date and ${to}::date
      union all
      select v.branch_id, -v.received_amount, to_char(v.business_date, 'YYYY-MM-DD'),
        'Non-tunai NT-' || v.id || ' ' || pm.name || ' ke ' || mp.name, 'nt:' || v.id
      from petshop.noncash_verifications v
      join petshop.payment_methods pm on pm.id = v.payment_method_id
      join petshop.money_places mp on mp.id = v.money_place_id
      where v.superseded_at is null and v.status = 'VERIFIED' and v.held_by <> 'FINANCE' and v.received_amount is not null
        and v.business_date between ${from}::date and ${to}::date`,
  ]);
  return [
    ...toItems('cash-undeposited', undeposited),
    ...toItems('cash-prior', prior),
    ...toItems('variances', [...shiftVar, ...depositVar]),
    ...toItems('non-finance', nonFinance),
  ];
}

/** C: non-tunai bulan ini yang belum terverifikasi (rumus Dana Belum Cair, dibatasi bulan). */
async function noncashItems(sql: Sql, month: string): Promise<BridgeItem[]> {
  const { from, to } = monthRange(month);
  const rows = await loadPendingFunds(sql, to, from);
  return rows
    .filter((r) => r.businessDate >= from && r.businessDate <= to && r.amount !== 0)
    .map((r) => ({
      branchId: r.branchId,
      line: r.businessDate < NONCASH_START ? 'noncash-before-start' : 'noncash-pending',
      amount: -r.amount,
      date: r.businessDate,
      label: `${r.paymentMethodName}${r.shiftNumber != null ? ` shift ${r.shiftNumber}` : ' (pelunasan tanpa shift)'} — ${r.status === 'AWAITING' ? 'dana belum cair' : 'belum diverifikasi'}${r.placeName ? ` · ${r.placeName}` : ''}`,
      ref: `nc:${r.key}`,
    }));
}

export type BridgeData = { bridge: Bridge; items: BridgeItem[]; flags: Flag[] };

/** Semua bahan satu bulan, lalu disusun jadi jembatan. */
export async function loadBridge(sql: Sql, month: string): Promise<BridgeData> {
  const [branches, sales, costs, pieces] = await Promise.all([loadBranches(sql), loadSales(sql, month), loadCosts(sql, month), loadSettlementPieces(sql)]);
  const names = new Map(branches.map((b) => [b.id, b.name]));
  const [internalSales, plFlags, internal, receivables, expenses, cash, noncash] = await Promise.all([
    loadInternalSales(sql, month, sales),
    loadFlags(sql, month, costs),
    internalSalesItems(sql, month, sales, names),
    receivableItems(sql, month),
    cashierExpenseItems(sql, month),
    cashItems(sql, month),
    noncashItems(sql, month),
  ]);
  const pl = buildProfitLoss({ branches, sales, costs, internalSales });
  const line = (key: string) => pl.lines.find((l) => l.key === key)!;
  const free = freeDeposits(pieces, month);
  const freeOf = new Map(free.rows.map((r) => [r.branchId, r.free]));

  const items = [
    ...goodsItems(sales, names, month),
    ...costItems(costs),
    ...settlementItems(pieces, month),
    ...internal, ...receivables, ...expenses, ...cash, ...noncash,
  ];

  // Kolom: kolom cabang Laba Rugi + cabang lain yang punya setoran/catatan bulan ini.
  const ids = new Set<number>(pl.columns.flatMap((c) => (c.branchId == null ? [] : [c.branchId])));
  for (const r of free.rows) ids.add(r.branchId);
  for (const i of items) if (i.branchId != null) ids.add(i.branchId);
  const bases: BranchBase[] = branches
    .filter((b) => ids.has(b.id))
    .map((b) => ({
      branchId: b.id, name: b.name,
      net: cell(line('net'), plColumnKey(b.id)),
      netSales: cell(line('sales'), plColumnKey(b.id)),
      free: freeOf.get(b.id) ?? 0,
    }));

  const bridge = buildBridge({
    bases, items,
    officeNet: cell(line('net'), OFFICE_KEY),
    totalNetSales: cell(line('sales'), PL_TOTAL_KEY),
  });

  const flags = [...plFlags];
  const open = items.filter((i) => i.line === 'noncash-pending' || (i.line === 'cash-undeposited' && /belum disetor|menunggu verifikasi/.test(i.label)));
  if (open.length) {
    flags.push({ key: 'deposits-open', label: 'Setoran bulan ini masih bisa berubah (shift belum disetor/diverifikasi, non-tunai belum diverifikasi)', count: open.length, amount: open.reduce((s, i) => s - i.amount, 0) });
  }
  return { bridge, items, flags };
}
