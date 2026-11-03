import { asc, eq, sql } from 'drizzle-orm';
import { casualWorkers, employees } from '@petshop/hris-db/schema/employees';
import { db } from '@/lib/db';
import { can, recordAudit, type Actor, type ServiceResult, type Tx } from '@/modules/access';

// Pekerja Lepas (KAR-L28; DRV-45; spec L8 §9 butir 2): nama + HP, tanpa akun, absen, slip, atau kasbon.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export type CasualWorker = { id: number; name: string; phone: string; active: boolean; createdAt: Date };

/** HP: angka saja 8–15 digit; awalan +62 / 62 diganti 0. */
export function normalizePhone(value: unknown): string | null {
  let text = String(value ?? '').replace(/[\s\-().]/g, '');
  if (text.startsWith('+62')) text = `0${text.slice(3)}`;
  else if (text.startsWith('62')) text = `0${text.slice(2)}`;
  return /^[0-9]{8,15}$/.test(text) ? text : null;
}

const canManage = (actor: Actor | null) => !!actor && (can(actor, 'freelancer.manage') || can(actor, 'unloading.create'));
const canView = canManage;

export async function listCasualWorkers(executor: typeof db | Tx = db): Promise<CasualWorker[]> {
  return executor.select({ id: casualWorkers.id, name: casualWorkers.name, phone: casualWorkers.phone, active: casualWorkers.active, createdAt: casualWorkers.createdAt })
    .from(casualWorkers).orderBy(asc(casualWorkers.name), asc(casualWorkers.id));
}

/** Orang lain (karyawan atau pekerja lepas) yang memakai HP ini, untuk ditawarkan dipilih (DRV-45). */
async function phoneOwner(tx: Tx, phone: string, exceptCasualId: number | null): Promise<string | null> {
  const people = await tx.select({ name: employees.name, phone: employees.phone }).from(employees).where(sql`${employees.phone} is not null`);
  const employee = people.find((p) => normalizePhone(p.phone) === phone);
  if (employee) return `karyawan ${employee.name}`;
  const [casual] = await tx.select().from(casualWorkers).where(eq(casualWorkers.phone, phone));
  if (casual && casual.id !== exceptCasualId) return `pekerja lepas ${casual.name}${casual.active ? '' : ' (nonaktif)'}`;
  return null;
}

export async function saveCasualWorkerIn(tx: Tx, actor: Actor, input: { id?: unknown; name: unknown; phone: unknown }): Promise<ServiceResult<CasualWorker>> {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) return fail(400, 'Nama pekerja lepas 2 sampai 80 huruf.');
  const phone = normalizePhone(input.phone);
  if (!phone) return fail(400, 'Nomor HP 8 sampai 15 angka.');
  const id = input.id ? Number(input.id) : null;
  const owner = await phoneOwner(tx, phone, id);
  if (owner) return fail(409, `Nomor HP itu sudah dipakai ${owner}. Pilih orang itu saja.`);
  if (id) {
    const [old] = await tx.select().from(casualWorkers).where(eq(casualWorkers.id, id));
    if (!old) return fail(404, 'Pekerja lepas tidak ditemukan.');
    const [row] = await tx.update(casualWorkers).set({ name, phone, updatedAt: new Date() }).where(eq(casualWorkers.id, id)).returning();
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'casual_worker', entityId: id, action: 'casual_worker.update', before: { name: old.name, phone: old.phone }, after: { name, phone } });
    return { ok: true, data: row };
  }
  const [row] = await tx.insert(casualWorkers).values({ name, phone, createdByAccountId: actor.accountId }).returning();
  await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'casual_worker', entityId: row.id, action: 'casual_worker.create', before: null, after: { name, phone } });
  return { ok: true, data: row };
}

export async function saveCasualWorker(actor: Actor | null, input: { id?: unknown; name: unknown; phone: unknown }): Promise<ServiceResult<CasualWorker>> {
  if (!canManage(actor)) return fail(403, 'Anda tidak berhak mengubah daftar Pekerja Lepas.');
  try {
    return await db.transaction((tx) => saveCasualWorkerIn(tx, actor!, input));
  } catch (error) {
    const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
    if (code === '23505') return fail(409, 'Nomor HP itu sudah dipakai pekerja lepas lain.');
    throw error;
  }
}

export async function setCasualWorkerActive(actor: Actor | null, id: number, active: boolean): Promise<ServiceResult<object>> {
  if (!canManage(actor)) return fail(403, 'Anda tidak berhak mengubah daftar Pekerja Lepas.');
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(casualWorkers).where(eq(casualWorkers.id, id));
    if (!old) return fail(404, 'Pekerja lepas tidak ditemukan.');
    if (active && (await phoneOwner(tx, old.phone, id))) return fail(409, 'Nomor HP orang ini sudah dipakai orang lain; ganti nomornya dulu.');
    await tx.update(casualWorkers).set({ active, updatedAt: new Date() }).where(eq(casualWorkers.id, id));
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'casual_worker', entityId: id, action: active ? 'casual_worker.activate' : 'casual_worker.deactivate', before: { active: old.active }, after: { active } });
    return { ok: true as const, data: {} };
  });
}

export async function casualWorkersScreen(actor: Actor | null, lastJoined: Map<number, string>) {
  if (!canView(actor)) return null;
  const rows = await listCasualWorkers();
  return {
    canManage: canManage(actor),
    rows: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, active: r.active, lastJoined: lastJoined.get(r.id) ?? null })),
  };
}
