import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L8a Laporan Bongkaran (spec L8 §3.1–3.3, §8) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
const backofficeCalls: { path: string; body: unknown; key: string }[] = [];
let backofficeAnswer: { ok: true; data: unknown } | { ok: false; error: string } = { ok: true, data: { poId: 77, poNumber: 'PO-20261107-0001', status: 'DRAFT', action: 'CREATED' } };
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
  callBackofficeInternal: async (path: string, body: unknown, key: string) => {
    backofficeCalls.push({ path, body: body instanceof FormData ? JSON.parse(String(body.get('data'))) : body, key });
    return backofficeAnswer;
  },
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l8a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const TODAY = '2026-11-07';
const REASON = 'Lupa mencatat karena listrik gudang padam';

let admin: postgres.Sql;
let sql: postgres.Sql;
let owner: Actor;
let owner2: Actor;
let kg: Actor;
let ids: Record<'owner' | 'owner2' | 'kg' | 'helper' | 'finance', number>;
let pr: typeof import('@/modules/payroll');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let supplierId: number;
let pakanId: number;
let pasirId: number;
let sakId: number;
let kgUom: number;
const announce = async () => {};

describe.skipIf(!ADMIN_URL)('L8a: Laporan Bongkaran', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(`${TODAY}T11:00:00+07:00`), toFake: ['Date'] });
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} });
    await sql`create schema petshop`;
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`;
    await sql.unsafe(readFileSync(new URL('hris-db/test-stubs/petshop-pos.sql', root), 'utf8'));
    const { drizzle } = requireAuth('drizzle-orm/postgres-js');
    const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator');
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL('auth/src/migrations/', root)), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth',
    });
    await migrationClient.end();
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude) values ('Gudang', ${GUDANG.latitude}, ${GUDANG.longitude})`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const [{ id: gudang }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const person = async (name: string, position: string, phone: string | null = null) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, phone) values (hris.next_employee_code(), ${name}, '2026-01-01', ${phone}) returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${gudang}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), owner2: await person('Irma', 'Pemilik'), kg: await person('Gani', 'Kepala Gudang'),
      helper: await person('Budi', 'Driver', '081200000001'), finance: await person('Fina', 'Finance'),
    };
    const [sak] = await sql`insert into petshop.units_of_measure (code, name, is_base) values ('SAK', 'Sak', false) returning id`;
    const [kgu] = await sql`insert into petshop.units_of_measure (code, name, is_base) values ('KG', 'Kilogram', true) returning id`;
    sakId = Number(sak.id);
    kgUom = Number(kgu.id);
    const [pakan] = await sql`insert into petshop.products (sku, name, base_uom_id, weight_gram) values ('PK-1', 'Pakan Kucing Ikan', ${kgUom}, 1000) returning id`;
    const [pasir] = await sql`insert into petshop.products (sku, name, base_uom_id) values ('PS-1', 'Pasir Gumpal', ${kgUom}) returning id`;
    pakanId = Number(pakan.id);
    pasirId = Number(pasir.id);
    await sql`insert into petshop.product_uom_conversions (product_id, uom_id, ratio, weight_gram) values (${pakanId}, ${sakId}, 25, 25000)`;
    await sql`insert into petshop.products (name, base_uom_id, product_kind) values ('Jasa Mandi', ${kgUom}, 'JASA_GROOMING')`;
    [{ id: supplierId }] = await sql`insert into petshop.suppliers (name) values ('PT Sumber Pakan') returning id`;
    supplierId = Number(supplierId);
    pr = await import('@/modules/payroll');
    engine = await import('@/modules/requests');
    handlers = { unloading_late: pr.unloadingLateHandler(announce) } as Record<string, RequestHandler>;
    const { loadActor } = await import('@/modules/access');
    owner = await loadActor(ids.owner + 1000, ids.owner);
    owner2 = await loadActor(ids.owner2 + 1000, ids.owner2);
    kg = await loadActor(ids.kg + 1000, ids.kg);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const photo = async (actor: Actor) => {
    const id = randomUUID();
    await sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${id}, 'image/jpeg', 10, 'x', ${actor.accountId})`;
    return id;
  };
  const report = async (actor: Actor, over: Record<string, unknown> = {}) => ({
    workDate: TODAY, supplierId,
    items: [{ productId: pakanId, uomId: sakId, quantity: '10', weightKg: null }, { productId: pasirId, uomId: kgUom, quantity: '33', weightKg: '1' }],
    participants: [`E${ids.kg}`, `E${ids.helper}`],
    photoIds: [await photo(actor)],
    ...over,
  });

  it('view kasir: produk BARANG + satuan dengan berat Master Produk kasir (satu sumber), supplier; jasa tidak tampil', async () => {
    const found = await pr.searchProducts(kg, 'pakan');
    expect(found.ok && found.data.units.map((u) => [u.uomName, u.weight?.kg ?? null])).toEqual([['Kilogram', '1.000'], ['Sak', '25.000']]);
    const none = await pr.searchProducts(kg, 'mandi');
    expect(none.ok && none.data).toEqual({ units: [], allowOther: true });
    expect((await pr.searchProducts(owner, 'pa')).ok).toBe(true);
  });

  it('simpan: berat kosong di kasir wajib diisi, jumlah bulat, Buku Upah per peserta, jumlah bagian = total, Finance diberi tahu', async () => {
    const noWeight = await pr.createUnloading(kg, await report(kg, { items: [{ productId: pasirId, uomId: kgUom, quantity: '33', weightKg: null }] }), announce);
    expect(noWeight.ok || noWeight.error).toMatch(/Isi berat per Kilogram/);
    const fraction = await pr.createUnloading(kg, await report(kg, { items: [{ productId: pasirId, uomId: kgUom, quantity: '33.3', weightKg: '1' }] }), announce);
    expect(fraction.ok || fraction.error).toMatch(/bulat/);
    const created = await pr.createUnloading(kg, await report(kg), announce);
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : 0;
    const [row] = await sql`select number, status, total_kg::text as kg, total_pay, rate, cost_branch_id, source, po_sync_status from hris.unloading_reports where id = ${id}`;
    expect(row).toMatchObject({ number: 'LB-20261107-01', status: 'ACTIVE', kg: '283.000', total_pay: 5660, rate: 20, source: 'ARRIVED_FIRST', po_sync_status: 'PENDING' });
    expect(row.cost_branch_id).not.toBeNull();
    const shares = await sql`select name, amount, plus_one, status from hris.unloading_shares where report_id = ${id} order by name`;
    expect(shares.map((s) => [s.name, s.amount, s.status])).toEqual([['Budi', 2830, 'ACTIVE'], ['Gani', 2830, 'ACTIVE']]);
    // Berat pasir diisi pertama kali: riwayat HRIS; beratnya sendiri dikirim ke Master Produk kasir saat sinkron.
    const filled = await sql`select from_kg, to_kg::text as kg from hris.unloading_weight_changes where product_id = ${pasirId}`;
    expect(filled.map((w) => [w.from_kg, w.kg])).toEqual([[null, '1.000']]);
    const [note] = await sql`select title from hris.notifications where kind = 'unloading.active' and recipient_account_id = ${ids.finance + 1000}`;
    expect(note.title).toMatch(/LB-20261107-01/);
    const detail = (await pr.unloadingDetailScreen(owner, id))!;
    expect(detail.flags.map((f) => f.label)).toContain('Pembuat ikut jadi peserta');
    // Angka Buku Upah terkunci (DRV-108).
    await expect(sql`update hris.unloading_shares set amount = 1 where report_id = ${id}`).rejects.toThrow(/tidak boleh diubah/);
  });

  it('berat kasir dipakai otomatis; ubah > 10% wajib alasan dan ditandai; laporan serupa wajib konfirmasi', async () => {
    const same = await pr.createUnloading(kg, await report(kg), announce);
    expect(same.ok || same.error).toMatch(/LB-20261107-01/);
    const confirmed = await pr.createUnloading(kg, await report(kg, { similarConfirmedId: 1 }), announce);
    expect(confirmed.ok).toBe(true);
    const changed = { productId: pakanId, uomId: sakId, quantity: '2', weightKg: '30' };
    const noReason = await pr.createUnloading(kg, await report(kg, { items: [changed] }), announce);
    expect(noReason.ok || noReason.error).toMatch(/alasan/);
    const ok = await pr.createUnloading(kg, await report(kg, { items: [{ ...changed, weightReason: 'Supplier ganti kemasan jadi 30 kg' }] }), announce);
    expect(ok.ok).toBe(true);
    const [change] = await sql`select from_kg::text as f, to_kg::text as t, flagged from hris.unloading_weight_changes where to_kg = 30`;
    expect(change).toMatchObject({ f: '25.000', t: '30.000', flagged: true });
    expect((await pr.weightsScreen(owner, 'CHANGED'))!.changed).toHaveLength(1);
  });

  it('barang lain wajib alasan; pekerja lepas HP kembar ditolak', async () => {
    const other = await pr.createUnloading(kg, await report(kg, { items: [{ productId: null, name: 'Kardus bekas', kg: '12.5', reason: 'pendek' }] }), announce);
    expect(other.ok).toBe(false);
    const emp = await import('@/modules/employees');
    const dup = await emp.saveCasualWorker(kg, { name: 'Asep', phone: '+62 812-0000-0001' });
    expect(dup.ok || dup.error).toMatch(/karyawan Budi/);
    const added = await emp.saveCasualWorker(kg, { name: 'Asep', phone: '081299999999' });
    expect(added.ok).toBe(true);
    const casualId = added.ok ? added.data.id : 0;
    const saved = await pr.createUnloading(kg, await report(kg, {
      items: [{ productId: null, name: 'Kardus bekas', kg: '12.5', reason: 'Tidak ada di daftar produk kasir' }], participants: [`C${casualId}`],
    }), announce);
    expect(saved.ok).toBe(true);
    const [share] = await sql`select casual_worker_id, amount from hris.unloading_shares where casual_worker_id = ${casualId}`;
    expect(share).toMatchObject({ amount: 250 });
  });

  it('laporan terlambat: menunggu tanpa upah → penyetuju peserta ditolak → disetujui Pemilik lain; ditolak = batal', async () => {
    const late = await report(kg, { workDate: '2026-11-01', participants: [`E${ids.helper}`, `E${ids.owner}`] });
    expect(await pr.unloadingNeedsApproval(kg, late.workDate)).toBe(true);
    expect((await engine.submitRequest(kg, 'unloading_late', handlers.unloading_late, { fields: late, attachmentIds: [] })).ok).toBe(false); // tanpa alasan
    const sent = await engine.submitRequest(kg, 'unloading_late', handlers.unloading_late, { fields: { ...late, lateReason: REASON }, attachmentIds: [] });
    expect(sent.ok).toBe(true);
    const requestId = sent.ok ? sent.data.id : 0;
    const [pending] = await sql`select id, status from hris.unloading_reports where request_id = ${requestId}`;
    expect(pending.status).toBe('PENDING');
    expect((await sql`select status from hris.unloading_shares where report_id = ${pending.id}`).every((s) => s.status === 'PENDING')).toBe(true);
    const version = async () => Number((await sql`select version from hris.requests where id = ${requestId}`)[0].version);
    const byParticipant = await engine.decideRequest(owner, requestId, handlers, { decision: 'APPROVE', expectedVersion: await version() });
    expect(byParticipant.ok || byParticipant.error).toMatch(/Peserta/);
    const approved = await engine.decideRequest(owner2, requestId, handlers, { decision: 'APPROVE', expectedVersion: await version() });
    expect(approved.ok).toBe(true);
    expect((await sql`select status from hris.unloading_reports where id = ${pending.id}`)[0].status).toBe('ACTIVE');
    expect((await sql`select status from hris.unloading_shares where report_id = ${pending.id}`).every((s) => s.status === 'ACTIVE')).toBe(true);

    const second = await engine.submitRequest(kg, 'unloading_late', handlers.unloading_late, { fields: { ...(await report(kg, { workDate: '2026-10-31' })), lateReason: REASON }, attachmentIds: [] });
    const secondId = second.ok ? second.data.id : 0;
    const rejected = await engine.decideRequest(owner, secondId, handlers, { decision: 'REJECT', reason: 'Bongkaran ini sudah dicatat di laporan lain', expectedVersion: Number((await sql`select version from hris.requests where id = ${secondId}`)[0].version) });
    expect(rejected.ok).toBe(true);
    const [gone] = await sql`select id, status from hris.unloading_reports where request_id = ${secondId}`;
    expect(gone.status).toBe('REJECTED');
    expect((await sql`select status from hris.unloading_shares where report_id = ${gone.id}`).every((s) => s.status === 'CANCELLED')).toBe(true);
    // Pemilik membuat laporan setua itu: langsung berlaku, alasan tetap wajib.
    expect((await pr.createUnloading(owner, await report(owner, { workDate: '2026-10-30', participants: [`E${ids.helper}`] }), announce)).ok).toBe(false);
    expect((await pr.createUnloading(owner, { ...(await report(owner, { workDate: '2026-10-30', participants: [`E${ids.helper}`] })), lateReason: REASON }, announce)).ok).toBe(true);
  });

  it('kirim ke kasir: Draft PO + berat gram; gagal kirim tidak membatalkan laporan; Kirim ulang memakai kunci sama', async () => {
    const [first] = await sql`select id from hris.unloading_reports where number = 'LB-20261107-01'`;
    backofficeAnswer = { ok: false, error: 'Kasir (backoffice) tidak dapat dihubungi.' };
    const failed = await pr.syncUnloadingToPos(kg, Number(first.id));
    expect(failed.ok).toBe(false);
    expect((await sql`select po_sync_status, status from hris.unloading_reports where id = ${first.id}`)[0]).toMatchObject({ po_sync_status: 'FAILED', status: 'ACTIVE' });
    backofficeAnswer = { ok: true, data: { poId: 77, poNumber: 'PO-20261107-0001', status: 'DRAFT', action: 'CREATED' } };
    const sent = await pr.syncUnloadingToPos(kg, Number(first.id));
    expect(sent.ok && sent.data.message).toMatch(/PO-20261107-0001/);
    const [a, b] = backofficeCalls.slice(-2);
    expect(a.key).toBe(b.key);
    expect(b.body).toMatchObject({
      mode: 'DRAFT', items: [{ productId: pakanId, uomId: sakId, qty: 10 }, { productId: pasirId, uomId: kgUom, qty: 33 }],
      weights: [{ productId: pasirId, uomId: kgUom, gram: 1000, expectedGram: null }],
    });
    expect((await sql`select po_sync_status, po_id, po_number from hris.unloading_reports where id = ${first.id}`)[0])
      .toMatchObject({ po_sync_status: 'SYNCED', po_id: 77, po_number: 'PO-20261107-0001' });
  });

  it('tanpa surat jalan: Draft menunggu Pemilik/GM (bukan pembuat); dari PO yang ada: selisih ditandai', async () => {
    const noNote = await pr.createUnloading(kg, await report(kg, { participants: [`E${ids.helper}`], items: [{ productId: pakanId, uomId: sakId, quantity: '3', weightKg: null }], noDeliveryNoteReason: 'Supplier lupa membawa surat jalan hari ini' }), announce);
    expect(noNote.ok).toBe(true);
    const noNoteId = noNote.ok ? noNote.data.id : 0;
    expect((await sql`select po_sync_status from hris.unloading_reports where id = ${noNoteId}`)[0].po_sync_status).toBe('WAITING_APPROVAL');
    expect((await pr.syncUnloadingToPos(kg, noNoteId)).ok).toBe(false);
    expect((await pr.approveUnloadingDraft(kg, noNoteId)).ok).toBe(false);
    expect((await pr.approveUnloadingDraft(owner, noNoteId)).ok).toBe(true);
    expect((await sql`select po_sync_status, draft_approved_by_account_id from hris.unloading_reports where id = ${noNoteId}`)[0])
      .toMatchObject({ po_sync_status: 'SYNCED', draft_approved_by_account_id: owner.accountId });

    const [po] = await sql`insert into petshop.purchase_orders (po_number, supplier_id, status) values ('PO-LAMA-1', ${supplierId}, 'APPROVED') returning id`;
    await sql`insert into petshop.purchase_order_items (po_id, product_id, uom_id, qty_ordered, qty_received) values (${po.id}, ${pakanId}, ${sakId}, 12, 0)`;
    const options = await pr.purchaseOrdersForSupplier(kg, supplierId);
    expect(options.ok && options.data.orders.map((o) => [o.number, o.lines.map((l) => [l.name, l.remaining])])).toEqual([['PO-LAMA-1', [['Pakan Kucing Ikan', '12.000']]]]);
    const matched = await pr.createUnloading(kg, await report(kg, {
      source: 'PO', poId: Number(po.id), participants: [`E${ids.helper}`], items: [{ productId: pakanId, uomId: sakId, quantity: '10', weightKg: null }],
    }), announce);
    expect(matched.ok).toBe(true);
    const matchedId = matched.ok ? matched.data.id : 0;
    expect((await sql`select source, po_number, po_mismatch from hris.unloading_reports where id = ${matchedId}`)[0]).toMatchObject({ source: 'PO', po_number: 'PO-LAMA-1', po_mismatch: true });
    expect((await sql`select po_qty::text as q from hris.unloading_items where report_id = ${matchedId}`)[0].q).toBe('12.000');
    const detail = (await pr.unloadingDetailScreen(owner, matchedId))!;
    expect(detail.flags.map((f) => f.label)).toContain('Selisih dengan PO');
    expect(detail.items[0].poDiff).toBe('-2.000');
    const wrongSupplier = await pr.createUnloading(kg, await report(kg, { source: 'PO', poId: 999999 }), announce);
    expect(wrongSupplier.ok || wrongSupplier.error).toMatch(/Pilih PO/);
  });

  it('daftar Belum dibayar dan kartu Beranda', async () => {
    const list = (await pr.unloadingListScreen(owner, { tab: 'UNPAID' }))!;
    expect(list.rows.length).toBeGreaterThanOrEqual(5);
    expect(list.head.unpaid.count).toBe(list.rows.length);
    const attention = (await pr.unloadingAttention(owner))!;
    expect(attention.unpaid.count).toBe(list.rows.length);
    expect(attention.weights).toBe(1);
  });
});
