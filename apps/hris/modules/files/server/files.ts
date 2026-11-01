import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { files } from '@petshop/hris-db/schema/files';
import { db } from '@/lib/db';
import type { Actor, ServiceResult, Tx } from '@/modules/access';
import { MAX_UPLOAD_BYTES, detectImageMime, isFileId } from '../rules/detect';

/**
 * Volume berkas HRIS (staging `hammielion-staging_hris_photos`, produksi `hris_photos`). Tidak dipasang di Caddy,
 * jadi berkas hanya keluar lewat route HRIS yang memeriksa hak (spec L2f-1 §3.4).
 */
function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(tmpdir(), 'hris-uploads');
}

const fail = (status: 400 | 403 | 404, error: string) => ({ ok: false as const, status, error });

/** Simpan satu foto. Pemakaiannya (lampiran pengajuan) diperiksa pemakainya, bukan di sini. */
export async function saveUpload(actor: Actor | null, file: File | null): Promise<ServiceResult<{ id: string }>> {
  if (!actor || actor.positionId == null) return fail(403, 'Anda tidak berhak mengunggah berkas.');
  if (!file || file.size === 0) return fail(400, 'Pilih foto yang akan diunggah.');
  if (file.size > MAX_UPLOAD_BYTES) return fail(400, 'Foto terlalu besar. Paling besar 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageMime(bytes);
  if (!mime) return fail(400, 'Berkas harus berupa foto (JPG, PNG, atau WebP).');
  const id = randomUUID();
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, id), bytes, { flag: 'wx' });
  await db.insert(files).values({
    id, mime, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    uploadedByAccountId: actor.accountId,
  });
  return { ok: true, data: { id } };
}

/** Berkas yang benar-benar ada dan diunggah akun ini (dipakai saat melampirkan). */
export async function filesUploadedBy(tx: Tx, accountId: number, ids: string[]): Promise<string[]> {
  const valid = ids.filter(isFileId);
  if (!valid.length) return [];
  const rows = await tx.select({ id: files.id, by: files.uploadedByAccountId }).from(files).where(inArray(files.id, valid));
  return rows.filter((row) => row.by === accountId).map((row) => row.id);
}

/** Isi berkas untuk route yang SUDAH memeriksa hak. */
export async function readStoredFile(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!isFileId(id)) return null;
  const [row] = await db.select({ mime: files.mime }).from(files).where(inArray(files.id, [id]));
  if (!row) return null;
  try {
    return { mime: row.mime, bytes: await readFile(path.join(uploadDir(), id)) };
  } catch {
    return null;
  }
}
