import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { authorizeInternalPermission } from '@/lib/internal-gate';
import { UPLOAD_IMAGE_EXTENSIONS, UPLOAD_MAX_BYTES } from '@/lib/proof-photo';
import {
  existingAttachmentFileIds, findSyncByKey, syncUnloading, UnloadingSyncError,
} from '@/lib/services/po-unloading';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const dataSchema = z.object({
  reportId: id,
  number: z.string().min(1).max(30),
  version: id,
  mode: z.enum(['DRAFT', 'MATCHED', 'CANCEL']),
  supplierId: id,
  poId: id.nullable().optional(),
  items: z.array(z.object({ productId: id, uomId: id, qty: z.number().int().positive() })).max(500),
  weights: z.array(z.object({ productId: id, uomId: id, gram: z.number().int().positive(), expectedGram: z.number().int().positive().nullable() })).max(500),
  photos: z.array(z.object({ field: z.string().max(40), hrisFileId: z.string().min(1).max(64), kind: z.enum(['DELIVERY_NOTE', 'GOODS']) })).max(5),
  otherItems: z.array(z.string().max(200)).max(100).optional(),
});

// Pintu internal HRIS: Laporan Bongkaran → Draft PO / PO yang ada (spec 2026-11-06 §3.2).
export async function POST(req: NextRequest) {
  const actor = await authorizeInternalPermission(req, 'po.unloading_sync', 'Akun kasir Anda tidak berhak membuat Draft PO dari bongkaran.');
  if (actor instanceof NextResponse) return actor;

  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 120) return NextResponse.json({ error: 'Header Idempotency-Key wajib.' }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const raw = form?.get('data');
  let json: unknown = null;
  try { json = typeof raw === 'string' ? JSON.parse(raw) : null; } catch { json = null; }
  const parsed = dataSchema.safeParse(json);
  if (!form || !parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const data = parsed.data;

  const replay = await findSyncByKey(idempotencyKey);
  if (replay) return NextResponse.json(replay);

  const known = await existingAttachmentFileIds(data.reportId);
  const photos: { url: string; kind: 'DELIVERY_NOTE' | 'GOODS'; hrisFileId: string }[] = [];
  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'public/uploads');
  for (const photo of data.photos) {
    if (known.has(photo.hrisFileId)) continue;
    const file = form.get(photo.field);
    if (!(file instanceof File)) return NextResponse.json({ error: 'Foto surat jalan tidak terkirim.' }, { status: 400 });
    const extension = UPLOAD_IMAGE_EXTENSIONS[file.type];
    if (!extension || file.size <= 0 || file.size > UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: 'Foto surat jalan harus gambar (maksimal 15 MB).' }, { status: 400 });
    }
    // Nama berkas dibuat server; disajikan Caddy dari volume yang sama di /uploads/* (pola rute unggah kasir).
    await mkdir(uploadDir, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
    photos.push({ url: `/uploads/${filename}`, kind: photo.kind, hrisFileId: photo.hrisFileId });
  }

  try {
    const result = await syncUnloading({ ...data, photos }, { localUserId: actor.localUserId, branchId: actor.branchId }, idempotencyKey);
    return NextResponse.json(result, { status: result.action === 'CREATED' ? 201 : 200 });
  } catch (error) {
    if (error instanceof UnloadingSyncError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Sinkron bongkaran gagal:', error);
    return NextResponse.json({ error: 'Gagal membuat/memperbarui PO dari bongkaran.' }, { status: 500 });
  }
}
