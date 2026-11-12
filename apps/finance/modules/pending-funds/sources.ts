import type postgres from 'postgres';
import { NONCASH_START, type PendingRow } from './rules';

/**
 * Pintu baca Dana Belum Cair (spec F2-6c §3). Angka sistem non-tunai per shift × metode dan pelunasan piutang
 * non-tunai tanpa shift per cabang × hari × metode — SALINAN rumus BO `listNoncashRows`
 * (apps/backoffice/lib/services/deposit-queries.ts, bagian `sh`/`computed`/`ver`); ubah keduanya bersamaan.
 * Hanya baris yang belum terverifikasi: belum disentuh Finance, atau ditandai "Dana belum cair".
 */

type Sql = postgres.Sql;

type Row = {
  k: string; branch_id: number; branch_name: string; business_date: string; shift_number: number | null;
  payment_method_name: string; amount: number; v_status: string | null; place_id: number | null; place_name: string | null;
};

export async function loadPendingFunds(sql: Sql, today: string, start = NONCASH_START): Promise<PendingRow[]> {
  const rows = await sql<Row[]>`
    with sh as (
      select s.id, s.branch_id, s.shift_number,
        to_char(s.opened_at at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as business_date
      from petshop.shifts s
      where s.status in ('CLOSED', 'FORCE_CLOSED')
        and to_char(coalesce(s.closed_at, s.force_closed_at, s.opened_at) at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD') >= ${start}
        and to_char(s.opened_at at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD') between ${start} and ${today}
    ),
    computed as (
      select 'S' || x.shift_id || ':' || x.payment_method_id as k, x.shift_id, sh.branch_id, sh.business_date,
        x.payment_method_id, sum(x.amount)::bigint as expected
      from (
        select t.shift_id, tp.payment_method_id, tp.amount
        from petshop.transaction_payments tp join petshop.transactions t on t.id = tp.transaction_id
        where t.status = 'COMPLETED' and t.shift_id in (select id from sh)
        union all
        select dp.shift_id, dp.payment_method_id, dp.amount
        from petshop.debt_payments dp
        where dp.voided_at is null and dp.shift_id in (select id from sh)
      ) x join sh on sh.id = x.shift_id
      group by x.shift_id, sh.branch_id, sh.business_date, x.payment_method_id
      union all
      select 'B' || coalesce(dp.branch_id, cd.branch_id) || ':' || d.day || ':' || dp.payment_method_id,
        null::int, coalesce(dp.branch_id, cd.branch_id), d.day, dp.payment_method_id, sum(dp.amount)::bigint
      from petshop.debt_payments dp
      join petshop.customer_debts cd on cd.id = dp.debt_id
      cross join lateral (select to_char(dp.created_at at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as day) d
      where dp.shift_id is null and dp.voided_at is null and coalesce(dp.branch_id, cd.branch_id) is not null
        and d.day between ${start} and ${today}
      group by coalesce(dp.branch_id, cd.branch_id), d.day, dp.payment_method_id
    ),
    ver as (
      select v.*, to_char(v.business_date, 'YYYY-MM-DD') as business_date_s,
        case when v.shift_id is not null then 'S' || v.shift_id || ':' || v.payment_method_id
          else 'B' || v.branch_id || ':' || to_char(v.business_date, 'YYYY-MM-DD') || ':' || v.payment_method_id end as k
      from petshop.noncash_verifications v
      where v.superseded_at is null and v.business_date between ${start}::date and ${today}::date
    )
    select coalesce(c.k, v.k) as k, coalesce(c.branch_id, v.branch_id) as branch_id, b.name as branch_name,
      coalesce(c.business_date, v.business_date_s) as business_date, s.shift_number, pm.name as payment_method_name,
      coalesce(c.expected, 0) as amount, v.status as v_status,
      case when v.id is not null then v.money_place_id else l.money_place_id end as place_id,
      case when v.id is not null then vmp.name else lmp.name end as place_name
    from computed c
    full outer join ver v on v.k = c.k
    join petshop.payment_methods pm on pm.id = coalesce(c.payment_method_id, v.payment_method_id)
    join petshop.branches b on b.id = coalesce(c.branch_id, v.branch_id)
    left join petshop.shifts s on s.id = coalesce(c.shift_id, v.shift_id)
    left join petshop.money_places vmp on vmp.id = v.money_place_id
    left join petshop.payment_method_money_places l
      on l.payment_method_id = coalesce(c.payment_method_id, v.payment_method_id) and l.branch_id = coalesce(c.branch_id, v.branch_id)
    left join petshop.money_places lmp on lmp.id = l.money_place_id
    where pm.type not in ('CASH', 'DEBT') and coalesce(v.status, '') <> 'VERIFIED' and coalesce(c.expected, 0) <> 0`;
  return rows.map((r) => ({
    key: r.k, branchId: Number(r.branch_id), branchName: r.branch_name, businessDate: r.business_date,
    shiftNumber: r.shift_number == null ? null : Number(r.shift_number), paymentMethodName: r.payment_method_name,
    amount: Number(r.amount), status: r.v_status === 'AWAITING_FUNDS' ? 'AWAITING' : 'UNVERIFIED',
    placeId: r.place_id == null ? null : Number(r.place_id), placeName: r.place_name,
  }));
}
