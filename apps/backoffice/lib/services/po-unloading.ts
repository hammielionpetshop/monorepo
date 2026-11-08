import {
  db, purchaseOrders, purchaseOrderItems, purchaseOrderUnloadings, purchaseOrderAttachments,
  suppliers, products, productUomConversions, eq, and, desc, inArray, sql,
} from '@/lib/db';
import { generatePoNumber } from '@/lib/po-number';
import { isServiceKind } from '@/lib/product-kind';

/**
 * Laporan Bongkaran HRIS → PO (spec docs/work/specs/2026-11-06-bongkaran-draft-po-design.md §3.2).
 * Satu kiriman = satu transaksi petshop: berat → PO (buat/ganti Draft, tautkan PO yang ada, batal,
 * atau tanda berubah) → lampiran → baris tautan. Kiriman ulang dengan kunci yang sama = jawaban sama.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type UnloadingMode = 'DRAFT' | 'MATCHED' | 'CANCEL';

export type UnloadingSyncInput = {
  reportId: number;
  number: string;
  version: number;
  mode: UnloadingMode;
  supplierId: number;
  poId?: number | null;
  items: { productId: number; uomId: number; qty: number }[];
  weights: WeightChange[];
  /** Foto yang sudah ditulis ke disk oleh rute (url) — `hrisFileId` mencegah lampiran ganda. */
  photos: { url: string; kind: 'DELIVERY_NOTE' | 'GOODS'; hrisFileId: string }[];
  /** Notes Draft: barang lain (tanpa produk POS) yang tidak ikut Draft. */
  otherItems?: string[];
};

export type WeightChange = { productId: number; uomId: number; gram: number; expectedGram: number | null };

export type SyncActor = { localUserId: number; branchId: number };

export type SyncResult = { poId: number | null; poNumber: string | null; status: string | null; action: string };

export class UnloadingSyncError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MATCHABLE = ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];

/** Hanya file yang belum menempel ke PO ini yang perlu ditulis rute ke disk. */
export async function existingAttachmentFileIds(reportId: number): Promise<Set<string>> {
  const rows = await db.select({ fileId: purchaseOrderAttachments.hrisFileId }).from(purchaseOrderAttachments)
    .where(eq(purchaseOrderAttachments.hrisReportId, reportId));
  return new Set(rows.map((r) => r.fileId).filter((v): v is string => !!v));
}

export async function findSyncByKey(idempotencyKey: string): Promise<SyncResult | null> {
  const [row] = await db.select({
    poId: purchaseOrderUnloadings.poId, action: purchaseOrderUnloadings.action,
    poNumber: purchaseOrders.poNumber, status: purchaseOrders.status,
  }).from(purchaseOrderUnloadings)
    .leftJoin(purchaseOrders, eq(purchaseOrderUnloadings.poId, purchaseOrders.id))
    .where(eq(purchaseOrderUnloadings.idempotencyKey, idempotencyKey)).limit(1);
  return row ? { poId: row.poId, poNumber: row.poNumber, status: row.status, action: row.action } : null;
}

/** Ubah berat per satuan di POS; `expectedGram` berbeda dari nilai sekarang → ditolak (saling timpa). */
export async function applyWeights(tx: Tx, weights: WeightChange[]) {
  for (const w of weights) {
    if (!Number.isInteger(w.gram) || w.gram <= 0) throw new UnloadingSyncError(400, 'Berat harus gram bulat lebih dari 0.');
    const [product] = await tx.select({ id: products.id, name: products.name, baseUomId: products.baseUomId, weightGram: products.weightGram })
      .from(products).where(eq(products.id, w.productId)).for('update').limit(1);
    if (!product) throw new UnloadingSyncError(400, `Produk ${w.productId} tidak ditemukan di POS.`);
    let current: number | null;
    if (product.baseUomId === w.uomId) {
      current = product.weightGram;
    } else {
      const [conv] = await tx.select({ weightGram: productUomConversions.weightGram }).from(productUomConversions)
        .where(and(eq(productUomConversions.productId, w.productId), eq(productUomConversions.uomId, w.uomId))).for('update').limit(1);
      if (!conv) throw new UnloadingSyncError(400, `Satuan untuk ${product.name} tidak ditemukan di POS.`);
      current = conv.weightGram;
    }
    if ((current ?? null) === w.gram) continue;
    if ((current ?? null) !== (w.expectedGram ?? null)) {
      throw new UnloadingSyncError(409, `Berat ${product.name} baru saja diubah di POS (${gramText(w.expectedGram)} → ${gramText(current)}). Muat ulang lalu kirim lagi.`);
    }
    if (product.baseUomId === w.uomId) {
      await tx.update(products).set({ weightGram: w.gram, updatedAt: new Date() }).where(eq(products.id, w.productId));
    } else {
      await tx.update(productUomConversions).set({ weightGram: w.gram })
        .where(and(eq(productUomConversions.productId, w.productId), eq(productUomConversions.uomId, w.uomId)));
    }
  }
}

function gramText(g: number | null | undefined) {
  return g == null ? 'kosong' : `${g} g`;
}

async function assertItems(tx: Tx, items: UnloadingSyncInput['items']) {
  const seen = new Set<string>();
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty <= 0) throw new UnloadingSyncError(400, 'Jumlah barang harus bilangan bulat lebih dari 0.');
    const key = `${item.productId}:${item.uomId}`;
    if (seen.has(key)) throw new UnloadingSyncError(400, 'Produk + satuan yang sama muncul dua kali.');
    seen.add(key);
  }
  const ids = [...new Set(items.map((i) => i.productId))];
  if (!ids.length) return;
  const rows = await tx.select({ id: products.id, name: products.name, kind: products.productKind, baseUomId: products.baseUomId })
    .from(products).where(inArray(products.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const convs = await tx.select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId })
    .from(productUomConversions).where(inArray(productUomConversions.productId, ids));
  const units = new Set(convs.map((c) => `${c.productId}:${c.uomId}`));
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) throw new UnloadingSyncError(400, `Produk ${item.productId} tidak ditemukan di POS.`);
    if (isServiceKind(p.kind)) throw new UnloadingSyncError(400, `${p.name} adalah produk jasa — tidak bisa masuk PO.`);
    if (p.baseUomId !== item.uomId && !units.has(`${item.productId}:${item.uomId}`)) {
      throw new UnloadingSyncError(400, `Satuan untuk ${p.name} tidak ditemukan di POS.`);
    }
  }
}

function draftNotes(input: UnloadingSyncInput) {
  const base = `Dari bongkaran ${input.number}`;
  return input.otherItems?.length ? `${base}. Barang lain (tidak masuk Draft, tambahkan manual bila perlu): ${input.otherItems.join(', ')}` : base;
}

async function replaceDraftItems(tx: Tx, poId: number, items: UnloadingSyncInput['items']) {
  const old = await tx.select({ productId: purchaseOrderItems.productId, uomId: purchaseOrderItems.uomId, unitCost: purchaseOrderItems.unitCost })
    .from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
  // Harga yang sudah diisi kantor untuk produk + satuan yang sama dipertahankan.
  const cost = new Map(old.map((o) => [`${o.productId}:${o.uomId}`, o.unitCost]));
  await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
  const rows = items.map((i) => ({
    poId, productId: i.productId, uomId: i.uomId, qtyOrdered: i.qty, qtyReceived: 0, qtyDamaged: 0,
    unitCost: cost.get(`${i.productId}:${i.uomId}`) ?? 0, qtyUnloaded: i.qty,
  }));
  if (rows.length) await tx.insert(purchaseOrderItems).values(rows);
  return rows.reduce((sum, r) => sum + r.qtyOrdered * r.unitCost, 0);
}

export async function syncUnloading(input: UnloadingSyncInput, actor: SyncActor, idempotencyKey: string): Promise<SyncResult> {
  return db.transaction(async (tx) => {
    // Kiriman bersamaan untuk laporan yang sama diantrikan supaya tidak lahir dua Draft.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('po_unloading'), ${input.reportId})`);
    const [replay] = await tx.select({ id: purchaseOrderUnloadings.id }).from(purchaseOrderUnloadings)
      .where(eq(purchaseOrderUnloadings.idempotencyKey, idempotencyKey)).limit(1);
    if (replay) return null;

    await applyWeights(tx, input.weights);

    const [last] = await tx.select({ poId: purchaseOrderUnloadings.poId, kind: purchaseOrderUnloadings.kind })
      .from(purchaseOrderUnloadings)
      .where(eq(purchaseOrderUnloadings.hrisReportId, input.reportId))
      .orderBy(desc(purchaseOrderUnloadings.id)).limit(1);
    const [po] = last?.poId
      ? await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, last.poId)).for('update').limit(1)
      : [];

    let poId: number | null = po?.id ?? null;
    let kind: 'DRAFT' | 'MATCHED' = input.mode === 'MATCHED' ? 'MATCHED' : (last?.kind as 'DRAFT' | 'MATCHED' | undefined) ?? 'DRAFT';
    let action: string;
    let changedAfterApproval: Date | null = null;

    if (input.mode === 'CANCEL') {
      if (!po) action = 'NONE';
      else if (po.status === 'DRAFT') {
        await tx.update(purchaseOrders).set({
          status: 'CANCELLED', notes: `${po.notes ?? ''}${po.notes ? '\n' : ''}Laporan bongkaran ${input.number} dibatalkan.`, updatedAt: new Date(),
        }).where(eq(purchaseOrders.id, po.id));
        action = 'CANCELLED';
      } else if (po.status === 'CANCELLED') action = 'NONE';
      else {
        action = 'FLAGGED';
        changedAfterApproval = new Date();
      }
    } else if (input.mode === 'MATCHED') {
      if (!input.poId) throw new UnloadingSyncError(400, 'PO yang dicocokkan wajib dipilih.');
      if (po && po.id !== input.poId) throw new UnloadingSyncError(409, `Laporan ${input.number} sudah tertaut ke PO ${po.poNumber}.`);
      const [target] = po ? [po] : await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).for('update').limit(1);
      if (!target) throw new UnloadingSyncError(404, 'PO tidak ditemukan.');
      if (target.supplierId !== input.supplierId) throw new UnloadingSyncError(400, `PO ${target.poNumber} bukan milik supplier laporan ini.`);
      await assertItems(tx, input.items);
      poId = target.id;
      if (MATCHABLE.includes(target.status)) {
        const poItems = await tx.select({ id: purchaseOrderItems.id, productId: purchaseOrderItems.productId, uomId: purchaseOrderItems.uomId })
          .from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, target.id));
        const qty = new Map(input.items.map((i) => [`${i.productId}:${i.uomId}`, i.qty]));
        for (const row of poItems) {
          await tx.update(purchaseOrderItems).set({ qtyUnloaded: qty.get(`${row.productId}:${row.uomId}`) ?? null })
            .where(eq(purchaseOrderItems.id, row.id));
        }
        action = 'MATCHED';
      } else if (!po) {
        throw new UnloadingSyncError(400, `PO ${target.poNumber} tidak bisa dicocokkan (status sudah lewat penerimaan atau batal).`);
      } else {
        action = 'FLAGGED';
        changedAfterApproval = new Date();
      }
    } else {
      await assertItems(tx, input.items);
      if (!input.items.length && !po) {
        action = 'NONE';
      } else if (!po) {
        const [supplier] = await tx.select({ isActive: suppliers.isActive }).from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
        if (!supplier) throw new UnloadingSyncError(400, 'Supplier tidak ditemukan di POS.');
        if (!supplier.isActive) throw new UnloadingSyncError(400, 'Supplier ini sudah nonaktif di POS; Draft PO tidak dibuat.');
        const poNumber = await generatePoNumber(tx);
        const [created] = await tx.insert(purchaseOrders).values({
          poNumber, branchId: actor.branchId, supplierId: input.supplierId, createdById: actor.localUserId,
          totalAmount: 0, notes: draftNotes(input), status: 'DRAFT', createdAt: new Date(), updatedAt: new Date(),
        }).returning({ id: purchaseOrders.id });
        await replaceDraftItems(tx, created.id, input.items);
        poId = created.id;
        kind = 'DRAFT';
        action = 'CREATED';
      } else if (po.status === 'DRAFT') {
        const total = await replaceDraftItems(tx, po.id, input.items);
        await tx.update(purchaseOrders).set({ totalAmount: total, updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id));
        action = 'REPLACED';
      } else {
        action = 'FLAGGED';
        changedAfterApproval = new Date();
      }
    }

    if (poId && input.photos.length) {
      await tx.insert(purchaseOrderAttachments).values(input.photos.map((p) => ({
        poId: poId!, url: p.url, kind: p.kind, source: 'HRIS', hrisReportId: input.reportId, hrisFileId: p.hrisFileId,
      }))).onConflictDoNothing();
    }

    await tx.insert(purchaseOrderUnloadings).values({
      poId, hrisReportId: input.reportId, reportNumber: input.number, reportVersion: input.version, kind, action,
      idempotencyKey, changedAfterApprovalAt: changedAfterApproval, createdById: actor.localUserId,
    });
    return true;
  }).then(async () => {
    const result = await findSyncByKey(idempotencyKey);
    if (!result) throw new UnloadingSyncError(500, 'Hasil sinkron bongkaran tidak ditemukan.');
    return result;
  });
}
