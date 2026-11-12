import type postgres from 'postgres';
import { START_DATE, type CashCount, type LineKind, type MoneyLine, type Place, type Source } from './rules';

/**
 * Pintu baca Finance (spec F2-6 §1, §3): semua catatan uang yang menyebut Tempat Uang Tunai/Rekening, sejak
 * START_DATE. Hanya baris yang berlaku (batal tidak dibaca); pembalikan `money_movements` bernilai negatif dan
 * ikut dibaca. Tabel yang dibaca di sini = daftar SELECT role `finance_app` di packages/db-roles/src/roles.sql.
 * Laci kasir tidak dihitung (uangnya dihitung per shift), jadi sisi laci dari setoran tidak menjadi baris.
 */

type Sql = postgres.Sql;

type PlaceRow = {
  id: number; name: string; kind: 'CASH' | 'BANK'; branch_id: number; branch_name: string; held_by: string; is_active: boolean;
  opening: number | null;
};

async function hasTable(sql: Sql, name: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`select to_regclass(${name}) is not null as ok`;
  return Boolean(row?.ok);
}

/** Tempat Uang Tunai/Rekening + saldo awal berlaku (null = belum diisi). */
export async function loadPlaces(sql: Sql): Promise<Place[]> {
  // Tabel saldo awal datang dari Back Office (F2-6a-1); DB yang belum memilikinya dianggap belum diisi.
  const withOpening = await hasTable(sql, 'petshop.money_place_opening_balances');
  const rows = withOpening
    ? await sql<PlaceRow[]>`
        select p.id, p.name, p.kind, p.branch_id, b.name as branch_name, p.held_by, p.is_active, ob.amount as opening
        from petshop.money_places p
        join petshop.branches b on b.id = p.branch_id
        left join petshop.money_place_opening_balances ob on ob.money_place_id = p.id and ob.cancelled_at is null
        where p.kind <> 'DRAWER'
        order by b.name, p.sort_order, p.name`
    : await sql<PlaceRow[]>`
        select p.id, p.name, p.kind, p.branch_id, b.name as branch_name, p.held_by, p.is_active, null::int as opening
        from petshop.money_places p
        join petshop.branches b on b.id = p.branch_id
        where p.kind <> 'DRAWER'
        order by b.name, p.sort_order, p.name`;
  return rows.map((r) => ({
    id: Number(r.id), name: r.name, kind: r.kind, branchId: Number(r.branch_id), branchName: r.branch_name,
    heldBy: r.held_by, isActive: r.is_active, opening: r.opening == null ? null : Number(r.opening),
  }));
}

type LineRow = { place_id: number; date: string; amount: number; kind: LineKind; grp: string | null; label: string; source: Source; ref: string };

/** Baris Back Office: setoran, non-tunai, pindah dana, Arus Kas, bayar supplier. */
async function backofficeLines(sql: Sql, to: string): Promise<LineRow[]> {
  return sql<LineRow[]>`
    -- Setoran tunai & non-tunai: sisi masuk ke tujuan (bukan laci).
    select mm.to_money_place_id as place_id, to_char(mm.occurred_on, 'YYYY-MM-DD') as date, mm.amount,
      case mm.source_type when 'CASH_DEPOSIT' then 'CASH_DEPOSIT' else 'NONCASH' end as kind,
      coalesce(b.name, '') as grp,
      case mm.source_type
        when 'CASH_DEPOSIT' then 'Setoran tunai ' || coalesce(b.name, '')
        else 'Non-tunai cair ' || coalesce(pm.name, '') || ' ' || coalesce(b.name, '') end
        || case when mm.reversal_of_id is not null then ' (koreksi)' else '' end as label,
      'BO' as source, 'mm:' || mm.id as ref
    from petshop.money_movements mm
    join petshop.money_places tp on tp.id = mm.to_money_place_id and tp.kind <> 'DRAWER'
    left join petshop.cash_deposits cd on mm.source_type = 'CASH_DEPOSIT' and cd.id = mm.source_id
    left join petshop.noncash_verifications nv on mm.source_type = 'NONCASH_VERIFICATION' and nv.id = mm.source_id
    left join petshop.payment_methods pm on pm.id = nv.payment_method_id
    left join petshop.branches b on b.id = coalesce(cd.branch_id, nv.branch_id)
    where mm.source_type in ('CASH_DEPOSIT', 'NONCASH_VERIFICATION')
      and mm.occurred_on between ${START_DATE}::date and ${to}::date

    union all
    -- Pindah dana: dua sisi dengan ref sama.
    select mm.to_money_place_id, to_char(mm.occurred_on, 'YYYY-MM-DD'), mm.amount, 'TRANSFER_IN', null,
      'Pindah dana dari ' || fp.name || case when mm.reversal_of_id is not null then ' (batal)' else '' end, 'BO', 'tr:' || mm.id
    from petshop.money_movements mm
    join petshop.money_places tp on tp.id = mm.to_money_place_id and tp.kind <> 'DRAWER'
    join petshop.money_places fp on fp.id = mm.from_money_place_id
    where mm.source_type = 'TRANSFER' and mm.occurred_on between ${START_DATE}::date and ${to}::date
    union all
    select mm.from_money_place_id, to_char(mm.occurred_on, 'YYYY-MM-DD'), -mm.amount, 'TRANSFER_OUT', null,
      'Pindah dana ke ' || tp.name || case when mm.reversal_of_id is not null then ' (batal)' else '' end, 'BO', 'tr:' || mm.id
    from petshop.money_movements mm
    join petshop.money_places fp on fp.id = mm.from_money_place_id and fp.kind <> 'DRAWER'
    join petshop.money_places tp on tp.id = mm.to_money_place_id
    where mm.source_type = 'TRANSFER' and mm.occurred_on between ${START_DATE}::date and ${to}::date

    union all
    -- Arus Kas (termasuk Biaya Rutin); batal tidak dibaca.
    select e.money_place_id, to_char(e.occurred_on, 'YYYY-MM-DD'),
      case when e.type = 'INCOME' then e.amount else -e.amount end,
      case when e.type = 'INCOME' then 'CASHFLOW_IN' else 'CASHFLOW_OUT' end,
      c.name,
      c.name || ' — ' || coalesce(br.name, 'Bersama') || coalesce(': ' || nullif(e.note, ''), ''),
      'BO', 'cf:' || e.id
    from petshop.cash_flow_entries e
    join petshop.cash_flow_categories c on c.id = e.category_id
    left join petshop.branches br on br.id = e.branch_id
    where e.money_place_id is not null and e.cancelled_at is null
      and e.occurred_on between ${START_DATE}::date and ${to}::date

    union all
    -- Bayar supplier "Dibayar dari" (F2-4a).
    select sp.money_place_id, to_char(sp.paid_at at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD'), -sp.amount, 'SUPPLIER', null,
      'Bayar supplier ' || coalesce(s.name, '') || coalesce(' — ' || po.po_number, ''), 'BO', 'sp:' || sp.id
    from petshop.supplier_payable_payments sp
    join petshop.supplier_payables p on p.id = sp.payable_id
    left join petshop.suppliers s on s.id = p.supplier_id
    left join petshop.purchase_orders po on po.id = p.po_id
    where sp.money_place_id is not null
      and (sp.paid_at at time zone 'UTC' at time zone 'Asia/Jakarta')::date between ${START_DATE}::date and ${to}::date`;
}

/** Baris HRIS: gaji, kasbon, pelunasan kasbon tunai, bongkaran, uang kembali bongkaran. */
async function hrisLines(sql: Sql, to: string): Promise<LineRow[]> {
  if (!(await hasTable(sql, 'hris.pay_batches'))) return [];
  return sql<LineRow[]>`
    select pp.money_place_id as place_id, to_char(pp.money_date, 'YYYY-MM-DD') as date, -sum(pp.amount)::int as amount,
      'PAYROLL' as kind, null as grp,
      'Gaji — ' || count(*) || ' pembayaran' as label, 'HRIS' as source, 'pb:' || pp.batch_id as ref
    from hris.payslip_payments pp
    where pp.kind = 'MONEY' and pp.status = 'ACTIVE' and pp.money_place_id is not null
      and pp.money_date between ${START_DATE}::date and ${to}::date
    group by pp.money_place_id, pp.money_date, pp.batch_id

    union all
    select h.money_place_id, to_char(h.money_date, 'YYYY-MM-DD'), -h.amount, 'ADVANCE', null,
      'Kasbon ' || coalesce(e.name, ''), 'HRIS', 'ah:' || h.id
    from hris.advance_handovers h
    join hris.advances a on a.id = h.advance_id
    left join hris.employees e on e.id = a.employee_id
    where h.status = 'ACTIVE' and h.money_place_id is not null
      and h.money_date between ${START_DATE}::date and ${to}::date

    union all
    select m.money_place_id, to_char(m.money_date, 'YYYY-MM-DD'), m.amount, 'ADVANCE_REPAY', null,
      'Pelunasan kasbon tunai ' || coalesce(e.name, ''), 'HRIS', 'am:' || m.id
    from hris.advance_movements m
    join hris.advances a on a.id = m.advance_id
    left join hris.employees e on e.id = a.employee_id
    where m.kind = 'CASH' and m.status = 'ACTIVE' and m.money_place_id is not null and m.money_date is not null
      and m.money_date between ${START_DATE}::date and ${to}::date

    union all
    select u.money_place_id, to_char(u.money_date, 'YYYY-MM-DD'), -u.amount, 'UNLOADING', null,
      'Bongkaran laporan #' || u.report_id || case when u.top_up_id is not null then ' (susulan)' else '' end, 'HRIS', 'up:' || u.id
    from hris.unloading_payments u
    where u.kind = 'MONEY' and u.status = 'ACTIVE' and u.money_place_id is not null
      and u.money_date between ${START_DATE}::date and ${to}::date

    union all
    select r.money_place_id, to_char(r.money_date, 'YYYY-MM-DD'), r.amount, 'UNLOADING_REFUND', null,
      'Uang kembali bongkaran ' || coalesce(o.name, ''), 'HRIS', 'ur:' || r.id
    from hris.unloading_overpayment_uses r
    join hris.unloading_overpayments o on o.id = r.overpayment_id
    where r.kind = 'REFUND' and r.status = 'ACTIVE' and r.money_place_id is not null
      and r.money_date between ${START_DATE}::date and ${to}::date`;
}

/** Baris Logistik: bayar sewa mobil (F2-5b). */
async function logisticsLines(sql: Sql, to: string): Promise<LineRow[]> {
  if (!(await hasTable(sql, 'logistics.vehicle_rental_payments'))) return [];
  return sql<LineRow[]>`
    select v.money_place_id as place_id, to_char(v.occurred_on, 'YYYY-MM-DD') as date, -v.amount as amount,
      'VEHICLE_RENTAL' as kind, null as grp,
      'Sewa mobil ' || coalesce(veh.name, '') || ' ' || to_char(v.for_month, 'MM/YYYY')
        || case when v.kind = 'TOP_UP' then ' (susulan)' else '' end as label,
      'LOGISTIK' as source, 'vr:' || v.id as ref
    from logistics.vehicle_rental_payments v
    left join logistics.vehicles veh on veh.id = v.vehicle_id
    where v.cancelled_at is null and v.occurred_on between ${START_DATE}::date and ${to}::date`;
}

/** Semua baris uang Tempat Uang Tunai/Rekening, START_DATE s.d. `to`. */
export async function loadLines(sql: Sql, to: string): Promise<MoneyLine[]> {
  const [bo, hris, logistics] = await Promise.all([backofficeLines(sql, to), hrisLines(sql, to), logisticsLines(sql, to)]);
  return [...bo, ...hris, ...logistics].map((r) => ({
    placeId: Number(r.place_id), date: r.date, amount: Number(r.amount), kind: r.kind, group: r.grp, label: r.label,
    source: r.source, ref: r.ref,
  }));
}

export type Unplaced = { key: 'CASHFLOW' | 'SUPPLIER' | 'FUEL'; label: string; count: number; amount: number };

/** Catatan uang sejak START_DATE yang belum menyebut Tempat Uang, jadi belum masuk saldo. */
export async function loadUnplaced(sql: Sql, to: string): Promise<Unplaced[]> {
  const [cf] = await sql<{ count: number; amount: number }[]>`
    select count(*)::int as count, coalesce(sum(amount), 0)::bigint as amount from petshop.cash_flow_entries
    where money_place_id is null and cancelled_at is null and occurred_on between ${START_DATE}::date and ${to}::date`;
  const [sp] = await sql<{ count: number; amount: number }[]>`
    select count(*)::int as count, coalesce(sum(amount), 0)::bigint as amount from petshop.supplier_payable_payments
    where money_place_id is null and method in ('CASH', 'TRANSFER', 'CEK')
      and (paid_at at time zone 'UTC' at time zone 'Asia/Jakarta')::date between ${START_DATE}::date and ${to}::date`;
  const result: Unplaced[] = [
    { key: 'CASHFLOW', label: 'Arus Kas tanpa Tempat Uang ("belum diketahui")', count: Number(cf.count), amount: Number(cf.amount) },
    { key: 'SUPPLIER', label: 'Bayar supplier tanpa "Dibayar dari"', count: Number(sp.count), amount: Number(sp.amount) },
  ];
  if (await hasTable(sql, 'logistics.fuel_expenses')) {
    const [fuel] = await sql<{ count: number; amount: number }[]>`
      select count(*)::int as count, coalesce(sum(amount), 0)::bigint as amount from logistics.fuel_expenses
      where filled_on between ${START_DATE}::date and ${to}::date`;
    result.push({ key: 'FUEL', label: 'Bensin Logistik (belum punya Tempat Uang)', count: Number(fuel.count), amount: Number(fuel.amount) });
  }
  return result;
}

type CountRow = {
  id: number; money_place_id: number; counted_on: string; amount: number; created_by_name: string | null; note: string | null;
  adj_type: string | null; adj_amount: number | null;
};

/** Hitung Kas berlaku (F2-6e-1) dengan tanggal hitung START_DATE s.d. `to`; DB tanpa tabelnya = belum ada hitungan. */
export async function loadCashCounts(sql: Sql, to: string): Promise<CashCount[]> {
  if (!(await hasTable(sql, 'petshop.cash_counts'))) return [];
  const rows = await sql<CountRow[]>`
    select c.id, c.money_place_id, to_char(c.counted_on, 'YYYY-MM-DD') as counted_on, c.amount, u.name as created_by_name, c.note,
      e.type as adj_type, e.amount as adj_amount
    from petshop.cash_counts c
    left join petshop.users u on u.id = c.created_by
    left join petshop.cash_flow_entries e on e.id = c.adjustment_cash_flow_entry_id and e.cancelled_at is null
    where c.cancelled_at is null and c.counted_on between ${START_DATE}::date and ${to}::date
    order by c.counted_on desc, c.id desc`;
  return rows.map((r) => ({
    id: Number(r.id), placeId: Number(r.money_place_id), countedOn: r.counted_on, amount: Number(r.amount),
    createdByName: r.created_by_name, note: r.note,
    adjustment: r.adj_type ? { direction: r.adj_type === 'EXPENSE' ? ('SHORT' as const) : ('OVER' as const), amount: Number(r.adj_amount) } : null,
  }));
}
