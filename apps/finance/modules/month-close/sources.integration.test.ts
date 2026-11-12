import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSnapshot, insertClosing, liveProfitLoss, loadClosings, loadOpenItems } from './sources';

// Tutup Bulan F2-6f-2 terhadap DB worktree lokal, dibaca & ditulis sebagai finance_app (koneksi baca saja seperti web
// Finance). Bulan berjalan belum bisa ditutup, jadi penutupan yang sah disisipkan pemilik DB dengan trigger dimatikan
// lalu dihapus lagi. Dilewati bila FINANCE_TEST_ADMIN_URL / FINANCE_TEST_DATABASE_URL kosong.
const ADMIN_URL = process.env.FINANCE_TEST_ADMIN_URL;
const READER_URL = process.env.FINANCE_TEST_DATABASE_URL;
const local = (u?: string) => !!u && ['localhost', '127.0.0.1'].includes(new URL(u).hostname) && /\/petshop_wt_[a-z0-9_]+$/.test(new URL(u).pathname);

describe.skipIf(!local(ADMIN_URL) || !local(READER_URL))('Tutup Bulan di Finance (DB lokal)', () => {
  const admin = postgres(ADMIN_URL ?? 'postgres://x@localhost/x', { max: 1, onnotice: () => {} });
  const reader = postgres(READER_URL ?? 'postgres://x@localhost/x', {
    max: 1,
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    connection: { default_transaction_read_only: true },
  });
  const run = randomUUID().slice(0, 8);
  let userId = 0;

  beforeAll(async () => {
    const [b] = await admin`insert into petshop.branches (code, name) values (${`TF${run}`}, ${`Toko TF ${run}`}) returning id`;
    const [role] = await admin`insert into petshop.roles (name) values (${`TF${run}`}) returning id`;
    [{ id: userId }] = await admin`insert into petshop.users (name, role_id, branch_id) values (${`TF${run}`}, ${role.id}, ${b.id}) returning id`;
  });

  afterAll(async () => {
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`delete from petshop.month_closings where closed_by = ${userId}`;
    });
    await Promise.all([admin.end(), reader.end()]);
  });

  it('salinan & daftar belum beres terbaca sebagai finance_app; bulan berjalan ditolak database, bukan karena hak', async () => {
    const snapshot = await buildSnapshot(reader, '2026-11');
    expect(snapshot.version).toBe(1);
    expect(snapshot.profitLoss.lines.some((l) => l.key === 'net')).toBe(true);
    expect(Array.isArray(await loadOpenItems(reader, '2026-11', snapshot.flags))).toBe(true);

    await expect(insertClosing(reader, { month: '2026-11', userId, withNotes: false, note: null, openItems: [], snapshot }))
      .rejects.toThrow(/Bulan berjalan belum bisa ditutup/);
    // Halaman lain tetap baca saja.
    await expect(reader`insert into petshop.month_closings (month, closed_by, snapshot) values ('2026-11-01', ${userId}, '{}')`)
      .rejects.toThrow(/read-only/);
  });

  it('penutupan tersimpan terbaca kembali dengan salinannya; ubah ditolak hak', async () => {
    const { profitLoss, flags } = await liveProfitLoss(reader, '2026-11');
    const snapshot = { version: 1, profitLoss, flags, balances: [], balanceTotal: 0 };
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`insert into petshop.month_closings (month, closed_by, with_notes, note, open_items, snapshot)
        values ('2026-11-01', ${userId}, true, 'slip menyusul', ${tx.json([{ key: 'x', label: 'x', count: 1, amount: null }])}, ${tx.json(snapshot)})`;
    });
    const [closing] = (await loadClosings(reader)).filter((c) => c.month === '2026-11');
    expect(closing).toMatchObject({ withNotes: true, note: 'slip menyusul', closedByName: `TF${run}`, openItems: [{ key: 'x' }] });
    expect(closing.snapshot.profitLoss.lines.length).toBe(profitLoss.lines.length);
    await expect(reader.begin('read write', (tx) => tx`update petshop.month_closings set note = 'ubah'`)).rejects.toThrow(/permission denied/);
  });
});
