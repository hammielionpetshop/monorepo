import { and, desc, eq } from 'drizzle-orm';
import { unloadingItems, unloadingPhotos, unloadingReports, unloadingWeightChanges } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { callBackofficeInternal } from '@/modules/accounts';
import { readStoredFile } from '@/modules/files';
import { kgToGrams } from '../rules/unloading';

// Laporan Bongkaran → POS (spec docs/work/specs/2026-11-06-bongkaran-draft-po-design.md §4.2). HRIS tidak menulis tabel kasir:
// laporan disimpan dulu di HRIS, lalu dikirim lewat pintu internal backoffice. Gagal kirim tidak membatalkan laporan atau upah.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export type PoSyncStatus = 'NONE' | 'WAITING_APPROVAL' | 'PENDING' | 'SYNCED' | 'FAILED';
export const PO_SYNC_LABELS: Record<PoSyncStatus, string> = {
  NONE: 'Tidak ada yang dikirim ke kasir',
  WAITING_APPROVAL: 'Tanpa surat jalan — Draft PO menunggu persetujuan Pemilik/GM',
  PENDING: 'Belum terkirim ke kasir',
  SYNCED: 'Terkirim ke kasir',
  FAILED: 'Gagal kirim ke kasir',
};

const canSend = (actor: Actor | null) => !!actor && (hasAction(actor, 'unloading.create') || !!actor.fullAccess);

type SyncResponse = { poId: number | null; poNumber: string | null; status: string | null; action: string };

/**
 * Kirim versi berjalan laporan ke kasir: Draft PO (barang datang dulu), cocokkan PO yang ada, atau batal. Kunci
 * idempoten per versi + jenis kiriman, jadi Kirim ulang aman. Pelaku = sesi yang menekan (Kepala Gudang / Pemilik / GM).
 */
export async function syncUnloadingToPos(actor: Actor | null, reportId: number, now: Date = new Date()): Promise<ServiceResult<{ message: string }>> {
  if (!canSend(actor)) return fail(403, 'Anda tidak berhak mengirim Laporan Bongkaran ke kasir.');
  const [report] = await db.select().from(unloadingReports).where(eq(unloadingReports.id, reportId));
  if (!report) return fail(404, 'Laporan tidak ditemukan.');
  if (['PENDING', 'REJECTED', 'WITHDRAWN'].includes(report.status)) {
    return { ok: true, data: { message: 'Laporan belum berlaku; dikirim ke kasir sesudah disetujui.' } };
  }
  const mode = report.status === 'CANCELLED' ? 'CANCEL' : report.source === 'PO' ? 'MATCHED' : 'DRAFT';
  const setStatus = (status: PoSyncStatus, extra: Partial<typeof unloadingReports.$inferInsert> = {}) =>
    db.update(unloadingReports).set({ poSyncStatus: status, ...extra }).where(eq(unloadingReports.id, report.id));

  if (mode === 'CANCEL' && report.poSyncedVersion == null) {
    await setStatus('NONE', { poSyncError: null });
    return { ok: true, data: { message: 'Belum pernah terkirim ke kasir; tidak ada PO yang perlu dibatalkan.' } };
  }
  if (mode === 'DRAFT' && report.poSyncStatus === 'WAITING_APPROVAL') {
    return fail(409, 'Laporan tanpa surat jalan: Draft PO dibuat sesudah Pemilik atau GM menyetujui.');
  }

  const items = await db.select().from(unloadingItems).where(and(eq(unloadingItems.reportId, report.id), eq(unloadingItems.version, report.version)));
  const products = items.filter((i) => i.productId != null && i.uomId != null && i.quantity != null);
  if (mode === 'DRAFT' && !products.length && report.poSyncedVersion == null) {
    await setStatus('NONE', { poSyncError: null });
    return { ok: true, data: { message: 'Hanya Barang lain; tidak ada Draft PO.' } };
  }

  const data = {
    reportId: report.id, number: report.number, version: report.version, mode, supplierId: report.supplierId, poId: report.source === 'PO' ? report.poId : null,
    items: mode === 'CANCEL' ? [] : products.map((i) => ({ productId: i.productId!, uomId: i.uomId!, qty: Number(i.quantity) })),
    weights: mode === 'CANCEL' ? [] : await weightsOf(report.id),
    photos: [] as { field: string; hrisFileId: string; kind: string }[],
    otherItems: items.filter((i) => i.productId == null).map((i) => i.productName),
  };
  const form = new FormData();
  if (mode !== 'CANCEL') {
    const photos = await db.select().from(unloadingPhotos).where(and(eq(unloadingPhotos.reportId, report.id), eq(unloadingPhotos.version, report.version)));
    for (const [index, photo] of photos.entries()) {
      const stored = await readStoredFile(photo.fileId);
      if (!stored) continue;
      const field = `photo_${index}`;
      form.append(field, new Blob([new Uint8Array(stored.bytes)], { type: stored.mime }), `${photo.fileId}`);
      data.photos.push({ field, hrisFileId: photo.fileId, kind: photo.kind });
    }
  }
  form.append('data', JSON.stringify(data));

  const sent = await callBackofficeInternal<SyncResponse>('/api/internal/hris/unloading-sync', form, `unloading:${report.id}:v${report.version}:${mode}`);
  if (!sent.ok) {
    await setStatus('FAILED', { poSyncError: sent.error.slice(0, 500) });
    return fail(409, `Laporan tersimpan, tetapi belum terkirim ke kasir: ${sent.error}`);
  }
  await setStatus(sent.data.poId || mode === 'CANCEL' ? 'SYNCED' : 'NONE', {
    poSyncError: null, poSyncedVersion: report.version, poSyncedAt: now,
    ...(sent.data.poId ? { poId: sent.data.poId, poNumber: sent.data.poNumber } : {}),
  });
  await db.transaction((tx) => recordAudit(tx, {
    actorAccountId: actor!.accountId, entity: 'unloading_report', entityId: report.id, action: 'unloading_report.po_sync', before: null,
    after: { mode, version: report.version, poId: sent.data.poId, action: sent.data.action },
  }));
  const what: Record<string, string> = {
    CREATED: `Draft PO ${sent.data.poNumber} dibuat di kasir.`,
    REPLACED: `Isi Draft PO ${sent.data.poNumber} diperbarui.`,
    MATCHED: `Jumlah bongkaran dicatat di ${sent.data.poNumber}.`,
    CANCELLED: `Draft PO ${sent.data.poNumber} dibatalkan.`,
    FLAGGED: `${sent.data.poNumber} sudah disetujui kantor; diberi tanda "Bongkaran berubah, periksa".`,
    NONE: 'Tidak ada PO yang berubah.',
  };
  return { ok: true, data: { message: what[sent.data.action] ?? 'Terkirim ke kasir.' } };
}

/** Berat yang diisi/diubah di laporan ini (riwayat terakhir per produk + satuan) → gram untuk Master Produk kasir. */
async function weightsOf(reportId: number) {
  const rows = await db.select().from(unloadingWeightChanges).where(eq(unloadingWeightChanges.reportId, reportId)).orderBy(desc(unloadingWeightChanges.id));
  const seen = new Set<string>();
  const out: { productId: number; uomId: number; gram: number; expectedGram: number | null }[] = [];
  for (const r of rows) {
    const key = `${r.productId}:${r.uomId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ productId: r.productId, uomId: r.uomId, gram: kgToGrams(r.toKg), expectedGram: r.fromKg == null ? null : kgToGrams(r.fromKg) });
  }
  return out;
}

/** Keputusan A: laporan tanpa surat jalan dibuatkan Draft PO hanya sesudah Pemilik/GM (bukan pembuat) menyetujui. */
export async function approveUnloadingDraft(actor: Actor | null, reportId: number, now: Date = new Date()): Promise<ServiceResult<{ message: string }>> {
  if (!actor?.fullAccess) return fail(403, 'Hanya Pemilik atau GM yang menyetujui Draft PO dari laporan tanpa surat jalan.');
  const [report] = await db.select().from(unloadingReports).where(eq(unloadingReports.id, reportId));
  if (!report) return fail(404, 'Laporan tidak ditemukan.');
  if (report.poSyncStatus !== 'WAITING_APPROVAL') return fail(409, 'Laporan ini tidak menunggu persetujuan Draft PO.');
  if (report.createdByAccountId === actor.accountId) return fail(403, 'Pembuat laporan tidak menyetujui Draft PO laporannya sendiri.');
  await db.update(unloadingReports).set({ poSyncStatus: 'PENDING', draftApprovedByAccountId: actor.accountId, draftApprovedAt: now }).where(eq(unloadingReports.id, report.id));
  await db.transaction((tx) => recordAudit(tx, { actorAccountId: actor.accountId, entity: 'unloading_report', entityId: report.id, action: 'unloading_report.draft_approve', before: { poSyncStatus: 'WAITING_APPROVAL' }, after: { poSyncStatus: 'PENDING' } }));
  return syncUnloadingToPos(actor, report.id, now);
}
