import type postgres from 'postgres';
import { paymentGroup, type Payable, type Payment, type SettlementPiece } from './rules';

/**
 * Pintu baca Utang Antar Cabang (spec F2-6c §2): utang internal, pembayarannya, dan potongan pelunasan otomatis.
 * Tabel yang dibaca = daftar SELECT `finance_app` di packages/db-roles/src/roles.sql.
 */

type Sql = postgres.Sql;

const WIB = (col: string) => `to_char(${col} at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

/** Semua utang internal (termasuk yang lunas/dihapuskan, untuk tren). */
export async function loadPayables(sql: Sql): Promise<Payable[]> {
  const rows = await sql<{
    id: number; ibt_number: string | null; debtor_id: number; debtor_name: string; creditor_id: number; creditor_name: string;
    total: number; paid: number; status: Payable['status']; born_on: string; updated_on: string;
  }[]>`
    select p.id, t.ibt_number, p.debtor_branch_id as debtor_id, db.name as debtor_name,
      p.creditor_branch_id as creditor_id, cb.name as creditor_name, p.total_amount as total, p.paid_amount as paid, p.status,
      ${sql.unsafe(WIB('p.created_at'))} as born_on, ${sql.unsafe(WIB('p.updated_at'))} as updated_on
    from petshop.inter_branch_payables p
    left join petshop.inter_branch_transfers t on t.id = p.transfer_id
    join petshop.branches db on db.id = p.debtor_branch_id
    join petshop.branches cb on cb.id = p.creditor_branch_id`;
  return rows.map((r) => ({
    id: Number(r.id), ibtNumber: r.ibt_number ?? `#${r.id}`, debtorId: Number(r.debtor_id), debtorName: r.debtor_name,
    creditorId: Number(r.creditor_id), creditorName: r.creditor_name, total: Number(r.total), paid: Number(r.paid),
    status: r.status, bornOn: r.born_on, updatedOn: r.updated_on,
  }));
}

/** Semua baris pembayaran utang internal (pembalikan bernilai negatif). */
export async function loadPayments(sql: Sql): Promise<Payment[]> {
  const rows = await sql<{ payable_id: number; date: string; amount: number; source_type: string | null }[]>`
    select payable_id, ${sql.unsafe(WIB('paid_at'))} as date, amount, source_type from petshop.inter_branch_payments`;
  return rows.map((r) => ({ payableId: Number(r.payable_id), date: r.date, amount: Number(r.amount), group: paymentGroup(r.source_type) }));
}

/**
 * Potongan pelunasan otomatis dengan tanggal uang setoran asalnya: setoran tunai = tanggal setor, non-tunai =
 * tanggal shift/hari, pelunasan susulan = tanggal dijalankan (WIB). Pembalikan memakai sumber yang sama.
 */
export async function loadSettlementPieces(sql: Sql): Promise<SettlementPiece[]> {
  const rows = await sql<{
    payer_id: number; payer_name: string; level: number; payable_id: number | null; creditor_id: number | null;
    creditor_name: string | null; amount: number; date: string | null;
  }[]>`
    select s.payer_branch_id as payer_id, pb.name as payer_name, s.level, s.payable_id,
      p.creditor_branch_id as creditor_id, cb.name as creditor_name, s.amount,
      coalesce(to_char(cd.deposit_date, 'YYYY-MM-DD'), to_char(nv.business_date, 'YYYY-MM-DD'), ${sql.unsafe(WIB('lr.created_at'))}) as date
    from petshop.deposit_settlements s
    join petshop.branches pb on pb.id = s.payer_branch_id
    left join petshop.inter_branch_payables p on p.id = s.payable_id
    left join petshop.branches cb on cb.id = p.creditor_branch_id
    left join petshop.cash_deposits cd on s.source_type = 'CASH_DEPOSIT' and cd.id = s.source_id
    left join petshop.noncash_verifications nv on s.source_type = 'NONCASH_VERIFICATION' and nv.id = s.source_id
    left join petshop.legacy_settlement_runs lr on s.source_type = 'LEGACY_RUN' and lr.id = s.source_id`;
  return rows
    .filter((r) => r.date != null)
    .map((r) => ({
      payerId: Number(r.payer_id), payerName: r.payer_name, level: Number(r.level),
      payableId: r.payable_id == null ? null : Number(r.payable_id),
      creditorId: r.creditor_id == null ? null : Number(r.creditor_id), creditorName: r.creditor_name,
      amount: Number(r.amount), date: r.date as string,
    }));
}
