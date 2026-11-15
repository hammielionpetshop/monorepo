import { eq } from 'drizzle-orm';
import { employees, identityChanges } from '@petshop/hris-db/schema/employees';
import { db } from '@/lib/db';
import { recordAudit, type Actor, type Tx } from '@/modules/access';
import { formatLongDate } from '../rules/dates';
import {
  GENDER_LABELS, IDENTITY_FIELDS, IDENTITY_LABELS, cleanPersonFields, identityChangeSummary, maskAccountNumber,
  touchesBankAccount, type Gender, type IdentityField,
} from '../rules/fields';
import { lockEmployee } from './data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

type Values = Partial<Record<IdentityField, string | null>>;

const BANK_ATTACHMENT = 'Foto buku tabungan atau kartu ATM';

function display(field: IdentityField, value: string | null, reveal: boolean): string | null {
  if (value == null || value === '') return null;
  if (field === 'gender') return GENDER_LABELS[value as Gender] ?? value;
  if (field === 'birthDate') return formatLongDate(value.slice(0, 10));
  if (field === 'bankAccountNumber' && !reveal) return maskAccountNumber(value);
  return value;
}

function pick(row: typeof employees.$inferSelect, fields: IdentityField[]): Values {
  return Object.fromEntries(fields.map((field) => [field, (row[field] as string | null) ?? null]));
}

async function load(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select().from(identityChanges).where(eq(identityChanges.requestId, requestId));
  return row ? { ...row, before: row.before as Values, after: row.after as Values } : null;
}

/**
 * Isi khas pengajuan "Ubah data diri" (KAR-66, KAR-L12, spec L2f-1 §3.3). Bentuknya mengikuti `RequestHandler`
 * modul `requests`; dirangkai di `lib/request-handlers.ts`, jadi modul ini tidak mengimpor modul `requests`.
 */
export const identityChangeHandler = {
  /** Hanya untuk diri sendiri; hanya kolom yang benar-benar berubah yang disimpan. */
  async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
    const cleaned = cleanPersonFields(input, IDENTITY_FIELDS);
    if (!cleaned.ok) return fail(400, cleaned.error);
    if (!(await lockEmployee(tx, actor.personId))) return fail(404, 'Data karyawan Anda tidak ditemukan.');
    const [current] = await tx.select().from(employees).where(eq(employees.id, actor.personId));
    const after = cleaned.values as Values;
    const changed = IDENTITY_FIELDS.filter((field) => Object.hasOwn(after, field)
      && (after[field] ?? null) !== ((current[field] as string | null) ?? null));
    if (!changed.length) return fail(400, 'Tidak ada data yang berubah.');
    if (changed.includes('name') && !after.name) return fail(400, 'Nama wajib diisi (2–100 karakter).');
    const before = pick(current, changed);
    const wanted = Object.fromEntries(changed.map((field) => [field, after[field] ?? null])) as Values;
    return {
      ok: true as const,
      data: {
        subjectEmployeeId: actor.personId,
        summary: identityChangeSummary(changed),
        dedupeKey: `employee:${actor.personId}`,
        requiredAttachment: touchesBankAccount(changed) ? BANK_ATTACHMENT : null,
        save: async (inner: Tx, requestId: number) => {
          await inner.insert(identityChanges).values({ requestId, employeeId: actor.personId, before, after: wanted });
        },
      },
    };
  },

  /**
   * Setelah disetujui: data karyawan diganti, tercatat sebelum/sesudah. Bila datanya sudah diubah orang lain
   * sejak diajukan, persetujuan ditolak supaya perubahan itu tidak tertimpa diam-diam (spec §9 butir 4).
   */
  async apply(tx: Tx, actorAccountId: number, requestId: number) {
    const change = await load(tx, requestId);
    if (!change) return fail(404, 'Isi pengajuan tidak ditemukan.');
    if (change.appliedAt) return fail(409, 'Perubahan ini sudah diterapkan.');
    if (!(await lockEmployee(tx, change.employeeId))) return fail(404, 'Karyawan tidak ditemukan.');
    const [current] = await tx.select().from(employees).where(eq(employees.id, change.employeeId));
    const fields = Object.keys(change.after) as IdentityField[];
    const stale = fields.filter((field) => ((current[field] as string | null) ?? null) !== (change.before[field] ?? null));
    if (stale.length) {
      return fail(409, 'Data sudah berubah sejak diajukan. Tolak pengajuan ini dan minta diajukan ulang.');
    }
    // Nama wajib terisi dan jenis kelamin sah sudah diperiksa saat diajukan (cleanPersonFields).
    await tx.update(employees).set({ ...(change.after as Partial<typeof employees.$inferInsert>), updatedAt: new Date() }).where(eq(employees.id, change.employeeId));
    await tx.update(identityChanges).set({ appliedAt: new Date() }).where(eq(identityChanges.requestId, requestId));
    await recordAudit(tx, {
      actorAccountId, entity: 'employee', entityId: change.employeeId, action: 'identity_change.apply',
      before: change.before, after: change.after, reason: `Pengajuan PJ-${requestId}`,
    });
    return { ok: true as const, effect: `${identityChangeSummary(fields)} sudah diganti.` };
  },

  async effectPreview(requestId: number) {
    const change = await load(db, requestId);
    if (!change) return '';
    const parts = (Object.keys(change.after) as IdentityField[])
      .map((field) => `${IDENTITY_LABELS[field]} menjadi "${display(field, change.after[field] ?? null, true) ?? 'kosong'}"`);
    return `Data karyawan langsung diganti: ${parts.join(', ')}.`;
  },

  async describe(requestId: number, reveal: boolean) {
    const change = await load(db, requestId);
    if (!change) return [];
    return (Object.keys(change.after) as IdentityField[]).map((field) => ({
      label: IDENTITY_LABELS[field],
      before: display(field, change.before[field] ?? null, reveal),
      after: display(field, change.after[field] ?? null, reveal),
    }));
  },

  async resubmitValues(requestId: number) {
    const change = await load(db, requestId);
    return change ? { ...change.after } : null;
  },
};

/** Nilai identitas sekarang (isian Ajukan perubahan); rekening utuh karena milik orang itu sendiri. */
export async function ownIdentityValues(actor: Actor | null): Promise<Record<IdentityField, string | null> | null> {
  if (!actor) return null;
  const [row] = await db.select().from(employees).where(eq(employees.id, actor.personId));
  return row ? (pick(row, [...IDENTITY_FIELDS]) as Record<IdentityField, string | null>) : null;
}
