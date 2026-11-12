import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadPendingFunds, pendingByPlace } from '@/modules/pending-funds';
import { debtorSummaries, freeDeposits, openDebts } from './rules';
import { loadPayables, loadPayments, loadSettlementPieces } from './sources';

// Pembaca Utang Antar Cabang & Dana Belum Cair terhadap DB worktree lokal (spec F2-6c §5.1). Data disiapkan sebagai
// pemilik DB, dibaca sebagai finance_app (baca saja). Dilewati bila FINANCE_TEST_ADMIN_URL / FINANCE_TEST_DATABASE_URL kosong.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const READER_URL = process.env.FINANCE_TEST_DATABASE_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL) || !local(READER_URL))('Pembaca Utang Antar Cabang & Dana Belum Cair (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', { max: 1, onnotice: () => {} });
  const reader = postgres(READER_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    connection: { default_transaction_read_only: true },
  });
  const run = randomUUID().slice(0, 8);
  const ids = { shop: 0, hub: 0, bank: 0, payOld: 0, payNew: 0 };

  beforeAll(async () => {
    const branch = async (code: string, name: string) =>
      (await admin`insert into petshop.branches (code, name) values (${`${code}${run}`}, ${`${name} ${run}`}) returning id`)[0].id as number;
    ids.shop = await branch('UA', 'Toko Utang');
    ids.hub = await branch('UP', 'Pusat Utang');
    const [role] = await admin`insert into petshop.roles (name) values (${`UA${run}`}) returning id`;
    const [user] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`UA${run}`}, ${role.id}, ${ids.shop}) returning id`;

    const ibt = async (no: string) =>
      (await admin`insert into petshop.inter_branch_transfers (ibt_number, source_branch_id, destination_branch_id, requested_by_id, status)
        values (${`IBT-${run}-${no}`}, ${ids.hub}, ${ids.shop}, ${user.id}, 'RECEIVED') returning id`)[0].id as number;
    // Utang lama (Oktober) sebagian dibayar manual; utang baru dilunasi sebagian oleh Setoran.
    [{ id: ids.payOld }] = await admin`insert into petshop.inter_branch_payables
      (transfer_id, debtor_branch_id, creditor_branch_id, total_amount, paid_amount, status, created_at)
      values (${await ibt('1')}, ${ids.shop}, ${ids.hub}, 1000000, 300000, 'PARTIAL', '2026-10-05 03:00:00') returning id`;
    [{ id: ids.payNew }] = await admin`insert into petshop.inter_branch_payables
      (transfer_id, debtor_branch_id, creditor_branch_id, total_amount, paid_amount, status, created_at)
      values (${await ibt('2')}, ${ids.shop}, ${ids.hub}, 2000000, 1500000, 'PARTIAL', '2026-11-09 03:00:00') returning id`;
    await admin`insert into petshop.inter_branch_payments (payable_id, amount, paid_at) values (${ids.payOld}, 300000, '2026-10-20 03:00:00')`;
    const [setoran] = await admin`insert into petshop.inter_branch_payments (payable_id, amount, source_type, reference_number, paid_at)
      values (${ids.payNew}, 1500000, 'SETORAN', ${`STN-${run}`}, '2026-11-10 03:00:00') returning id`;

    // Setoran tunai Rp2.000.000: Rp1.500.000 melunasi utang baru, Rp500.000 setoran bebas.
    [{ id: ids.bank }] = await admin`insert into petshop.money_places (name, kind, branch_id, bank_name, account_number, held_by)
      values (${`Rek Utang ${run}`}, 'BANK', ${ids.shop}, 'BCA', '9', 'FINANCE') returning id`;
    const [dep] = await admin`insert into petshop.cash_deposits
      (deposit_number, branch_id, destination_money_place_id, deposit_date, reported_amount, report_channel, reported_by, status, received_amount, verified_by, verified_at, verified_held_by)
      values (${`STN-${run}`}, ${ids.shop}, ${ids.bank}, '2026-11-10', 2000000, 'BACKOFFICE', ${user.id}, 'VERIFIED', 2000000, ${user.id}, now(), 'FINANCE') returning id`;
    await admin`insert into petshop.deposit_settlements (source_type, source_id, level, payer_branch_id, payable_id, payment_id, amount, created_by)
      values ('CASH_DEPOSIT', ${dep.id}, 1, ${ids.shop}, ${ids.payNew}, ${setoran.id}, 1500000, ${user.id}),
             ('CASH_DEPOSIT', ${dep.id}, 1, ${ids.shop}, null, null, 500000, ${user.id})`;

    // Non-tunai: shift hari ini dengan QRIS Rp250.000 (belum diverifikasi) dan transfer Rp400.000 (ditandai belum cair).
    const [qris] = await admin`insert into petshop.payment_methods (name, type) values (${`QRIS ${run}`}, 'QRIS') returning id`;
    const [tf] = await admin`insert into petshop.payment_methods (name, type) values (${`TF ${run}`}, 'BANK_TRANSFER') returning id`;
    await admin`insert into petshop.payment_method_money_places (payment_method_id, branch_id, money_place_id) values (${qris.id}, ${ids.shop}, ${ids.bank})`;
    const [shift] = await admin`insert into petshop.shifts (branch_id, opened_by_id, shift_number, assigned_cashiers, opening_cash, status, closed_at)
      values (${ids.shop}, ${user.id}, 1, '[]', 0, 'CLOSED', now()) returning id, to_char(opened_at at time zone 'UTC' at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as day`;
    const trx = async (no: string, methodId: number, amount: number) => {
      const [t] = await admin`insert into petshop.transactions (trx_number, branch_id, shift_id, cashier_id, total_amount, payable_amount, paid_amount, change_amount)
        values (${`TRX-${run}-${no}`}, ${ids.shop}, ${shift.id}, ${user.id}, ${amount}, ${amount}, ${amount}, 0) returning id`;
      await admin`insert into petshop.transaction_payments (transaction_id, payment_method_id, amount) values (${t.id}, ${methodId}, ${amount})`;
    };
    await trx('1', qris.id, 250000);
    await trx('2', tf.id, 400000);
    await admin`insert into petshop.noncash_verifications
      (shift_id, branch_id, business_date, payment_method_id, expected_amount, money_place_id, held_by, status, created_by)
      values (${shift.id}, ${ids.shop}, ${shift.day}, ${tf.id}, 400000, ${ids.bank}, 'FINANCE', 'AWAITING_FUNDS', ${user.id})`;
  });

  afterAll(async () => {
    await Promise.all([admin.end(), reader.end()]);
  });

  it('utang terbuka sama dengan sisa BO, rincian bayar, utang lama, setoran bebas', async () => {
    const [payables, payments, pieces] = await Promise.all([loadPayables(reader), loadPayments(reader), loadSettlementPieces(reader)]);
    const mine = openDebts(payables, payments, '2026-11-12').filter((d) => d.debtorId === ids.shop);
    expect(mine.map((d) => [d.id, d.remaining, d.legacy])).toEqual([[ids.payOld, 700_000, true], [ids.payNew, 500_000, false]]);
    expect(mine[0].paidBy).toEqual({ AUTO: 0, MANUAL: 300_000, RETURN: 0 });
    expect(mine[1].paidBy).toEqual({ AUTO: 1_500_000, MANUAL: 0, RETURN: 0 });
    expect(debtorSummaries(mine).rows[0]).toMatchObject({ remaining: 1_200_000, legacyRemaining: 700_000, red: true });

    const free = freeDeposits(pieces.filter((p) => p.payerId === ids.shop), '2026-11');
    expect(free.rows[0]).toMatchObject({ ownDeposits: 2_000_000, settled: 1_500_000, free: 500_000 });
  });

  it('dana belum cair per rekening: belum cair & belum diverifikasi', async () => {
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const rows = (await loadPendingFunds(reader, today)).filter((r) => r.branchId === ids.shop);
    const board = pendingByPlace(rows, today);
    expect(board.groups.map((g) => [g.placeId, g.awaiting.amount, g.unverified.amount])).toEqual([[ids.bank, 400_000, 250_000]]);
  });

  it('finance_app ditolak menulis', async () => {
    await expect(reader`update petshop.inter_branch_payables set notes = notes where id = ${ids.payOld}`).rejects.toThrow();
    await expect(reader.unsafe('delete from petshop.deposit_settlements where id = -1')).rejects.toThrow();
  });
});
