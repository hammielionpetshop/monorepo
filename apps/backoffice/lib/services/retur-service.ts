import { alias } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { StockService } from './stock-service';
import { hitungPemotonganPiutang, hitungPengembalianPiutang } from '../retur-debt';
import {
  db,
  transactions,
  transactionItems,
  returns,
  returnItems,
  products,
  productStocks,
  customerDebts,
  auditLogs,
  branches,
  users,
  unitsOfMeasure,
  eq,
  and,
  or,
  ne,
  sql,
  like,
  ilike,
  gte,
  lte,
  desc,
  count,
  isNull,
  isNotNull,
  inArray,
} from '../db';
import Big from 'big.js';

export class ReturError extends Error {
  constructor(
    public readonly code: 'INTER_BRANCH_SALE' | 'TRX_VOIDED',
    message: string,
  ) {
    super(message);
    this.name = 'ReturError';
  }
}

export const PESAN_RETUR_ANTAR_CABANG =
  'Transaksi ini adalah kiriman antar cabang (hasil konversi Internal PO), jadi tidak bisa diretur dari sini. ' +
  'Barangnya harus dikembalikan lewat transfer internal arah sebaliknya, supaya stok kedua cabang dan hutang antar cabangnya ikut terkoreksi.';

export type TransactionWithReturInfo = {
  id: number;
  trxNumber: string;
  createdAt: Date;
  totalAmount: number;
  items: {
    transactionItemId: number;
    productId: number | null;
    productName: string;
    sku: string | null;
    uomId: number;
    qty: number;
    remainingQty: string;
    unitPrice: number;
    cogs: string;
  }[];
  isFullyReturned: boolean;
  /** Transaksi hasil konversi Internal PO — tidak boleh diretur lewat layar ini. */
  isInterBranch: boolean;
  /** Sisa piutang pelanggan yang masih menempel di transaksi ini; 0 bila bukan penjualan kredit. */
  debtRemaining: number;
};

export type ReturnStatusFilter = '' | 'ACTIVE' | 'CANCELLED';

export type ReturnListFilters = {
  /** null = semua cabang (hanya untuk `branchScope === 'ALL'`) */
  branchId: number | null;
  q: string;
  status: ReturnStatusFilter;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
};

export type ReturnListRow = {
  id: string;
  returnNumber: string;
  transactionId: number;
  trxNumber: string;
  branchId: number;
  branchName: string;
  processedByName: string;
  reason: string;
  totalRefundAmount: number;
  totalQty: number;
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
};

export type ReturnListResult = {
  data: ReturnListRow[];
  total: number;
  page: number;
  totalPages: number;
  summary: {
    activeCount: number;
    cancelledCount: number;
    activeRefundAmount: number;
  };
};

export type ReturnDetailItem = {
  id: string;
  productId: number;
  productName: string;
  sku: string | null;
  uomName: string;
  qty: number;
  unitPrice: number;
  cogs: number;
  refundAmount: number;
};

export type ReturnDetail = Omit<ReturnListRow, 'totalQty' | 'itemCount'> & {
  processedById: number;
  items: ReturnDetailItem[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export class ReturService {
  /**
   * Menghasilkan nomor retur unik dengan format RTN-YYYYMMDD-XXXX.
   * Counter XXXX dihitung berdasarkan jumlah retur pada hari tersebut.
   */
  static async generateReturnNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RTN-${dateStr}-`;

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(returns)
      .where(like(returns.returnNumber, `${prefix}%`));

    const nextId = (Number(row?.count || 0) + 1).toString().padStart(4, '0');
    return `${prefix}${nextId}`;
  }

  /**
   * Mengambil detail transaksi berdasarkan nomor transaksi dan branch.
   * Menghitung sisa kuantitas yang bisa diretur per item.
   */
  static async getTransactionByTrxNumber(trxNumber: string, branchId: number): Promise<TransactionWithReturInfo | null> {
    const trxRows = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        createdAt: transactions.createdAt,
        totalAmount: transactions.payableAmount,
        sourceIbtId: transactions.sourceIbtId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.trxNumber, trxNumber),
          eq(transactions.branchId, branchId)
        )
      )
      .limit(1);

    if (trxRows.length === 0) return null;

    const trx = trxRows[0];

    // Sisa piutang transaksi ini, supaya layar retur bisa memberi tahu operator berapa yang
    // akan memotong hutang dan berapa yang benar-benar harus dikembalikan tunai.
    const [debtRow] = await db
      .select({
        remaining: sql<string>`COALESCE(SUM(${customerDebts.remainingAmount}), 0)`,
      })
      .from(customerDebts)
      .where(and(eq(customerDebts.transactionId, trx.id), ne(customerDebts.status, 'VOIDED')));

    const itemRows = await db
      .select({
        transactionItemId: transactionItems.id,
        productId: transactionItems.productId,
        productName: products.name,
        sku: products.sku,
        uomId: transactionItems.uomId,
        qty: transactionItems.qty,
        unitPrice: transactionItems.unitPrice,
        cogs: transactionItems.cogs,
        returnedQty: sql<string>`COALESCE(SUM(CASE WHEN ${returns.cancelledAt} IS NULL AND ${returnItems.id} IS NOT NULL THEN ${returnItems.qty} ELSE 0 END), '0')`,
      })
      .from(transactionItems)
      .leftJoin(products, eq(products.id, transactionItems.productId))
      .leftJoin(returnItems, eq(returnItems.transactionItemId, transactionItems.id))
      .leftJoin(returns, eq(returns.id, returnItems.returnId))
      // Item yang dihapus lewat koreksi transaksi sudah dikembalikan stoknya — tidak bisa diretur lagi
      .where(and(eq(transactionItems.transactionId, trx.id), eq(transactionItems.isRemoved, false)))
      .groupBy(
        transactionItems.id,
        transactionItems.productId,
        products.name,
        products.sku,
        transactionItems.uomId,
        transactionItems.qty,
        transactionItems.unitPrice,
        transactionItems.cogs
      );

    const items = itemRows.map(row => {
      const originalQty = new Big(row.qty);
      const returnedQty = new Big(row.returnedQty || '0');
      const remainingQty = originalQty.minus(returnedQty);

      return {
        transactionItemId: row.transactionItemId,
        productId: row.productId,
        productName: row.productName || 'Produk Tidak Ditemukan',
        sku: row.sku,
        uomId: row.uomId,
        qty: row.qty,
        remainingQty: remainingQty.lt(0) ? '0' : remainingQty.toString(),
        unitPrice: row.unitPrice,
        cogs: String(row.cogs ?? 0),
      };
    });

    const isFullyReturned = items.length > 0 && items.every(item => new Big(item.remainingQty).lte(0));

    return {
      id: trx.id,
      trxNumber: trx.trxNumber,
      createdAt: trx.createdAt,
      totalAmount: trx.totalAmount,
      items,
      isFullyReturned,
      isInterBranch: trx.sourceIbtId !== null,
      debtRemaining: Number(debtRow?.remaining ?? 0),
    };
  }

  /**
   * Menyusun kondisi WHERE bersama untuk daftar & ringkasan retur, supaya keduanya
   * tidak pernah menghitung dari himpunan yang berbeda.
   */
  private static buildListConditions(filters: Omit<ReturnListFilters, 'page' | 'limit'>): SQL[] {
    const conditions: SQL[] = [];

    if (filters.branchId !== null) conditions.push(eq(returns.branchId, filters.branchId));
    if (filters.status === 'ACTIVE') conditions.push(isNull(returns.cancelledAt));
    if (filters.status === 'CANCELLED') conditions.push(isNotNull(returns.cancelledAt));

    if (filters.q) {
      const term = `%${filters.q}%`;
      const match = or(ilike(returns.returnNumber, term), ilike(transactions.trxNumber, term));
      if (match) conditions.push(match);
    }

    if (ISO_DATE_RE.test(filters.dateFrom)) {
      conditions.push(gte(returns.createdAt, new Date(`${filters.dateFrom}T00:00:00.000+07:00`)));
    }
    if (ISO_DATE_RE.test(filters.dateTo)) {
      conditions.push(lte(returns.createdAt, new Date(`${filters.dateTo}T23:59:59.999+07:00`)));
    }

    return conditions;
  }

  /**
   * Riwayat retur dengan filter, paginasi, dan ringkasan.
   * Ringkasan dihitung atas seluruh hasil filter — bukan hanya halaman yang tampil.
   */
  static async listReturns(filters: ReturnListFilters): Promise<ReturnListResult> {
    const { page, limit, ...rest } = filters;
    const conditions = this.buildListConditions(rest);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const cancelledBy = alias(users, 'return_cancelled_by');

    const [totalRow, summaryRow, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(returns)
        .innerJoin(transactions, eq(transactions.id, returns.transactionId))
        .where(whereClause),
      db
        .select({
          activeCount: sql<string>`COUNT(*) FILTER (WHERE ${returns.cancelledAt} IS NULL)`,
          cancelledCount: sql<string>`COUNT(*) FILTER (WHERE ${returns.cancelledAt} IS NOT NULL)`,
          activeRefundAmount: sql<string>`COALESCE(SUM(${returns.totalRefundAmount}) FILTER (WHERE ${returns.cancelledAt} IS NULL), 0)`,
        })
        .from(returns)
        .innerJoin(transactions, eq(transactions.id, returns.transactionId))
        .where(whereClause),
      db
        .select({
          id: returns.id,
          returnNumber: returns.returnNumber,
          transactionId: returns.transactionId,
          trxNumber: transactions.trxNumber,
          branchId: returns.branchId,
          branchName: branches.name,
          processedByName: users.name,
          reason: returns.reason,
          totalRefundAmount: returns.totalRefundAmount,
          createdAt: returns.createdAt,
          cancelledAt: returns.cancelledAt,
          cancelledByName: cancelledBy.name,
          cancelReason: returns.cancelReason,
        })
        .from(returns)
        .innerJoin(transactions, eq(transactions.id, returns.transactionId))
        .leftJoin(branches, eq(branches.id, returns.branchId))
        .leftJoin(users, eq(users.id, returns.processedById))
        .leftJoin(cancelledBy, eq(cancelledBy.id, returns.cancelledById))
        .where(whereClause)
        .orderBy(desc(returns.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    const total = Number(totalRow[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const summary = {
      activeCount: Number(summaryRow[0]?.activeCount ?? 0),
      cancelledCount: Number(summaryRow[0]?.cancelledCount ?? 0),
      activeRefundAmount: Number(summaryRow[0]?.activeRefundAmount ?? 0),
    };

    if (rows.length === 0) {
      return { data: [], total, page, totalPages, summary };
    }

    // Agregat item ditarik terpisah, bukan lewat join: menggabungkannya ke query di atas
    // akan menggandakan baris header dan merusak `totalRefundAmount`.
    const aggRows = await db
      .select({
        returnId: returnItems.returnId,
        itemCount: count(),
        totalQty: sql<string>`COALESCE(SUM(${returnItems.qty}), 0)`,
      })
      .from(returnItems)
      .where(inArray(returnItems.returnId, rows.map((r) => r.id)))
      .groupBy(returnItems.returnId);

    const aggMap = new Map(aggRows.map((a) => [a.returnId, a]));

    const data: ReturnListRow[] = rows.map((r) => {
      const agg = aggMap.get(r.id);
      return {
        id: r.id,
        returnNumber: r.returnNumber,
        transactionId: r.transactionId,
        trxNumber: r.trxNumber,
        branchId: r.branchId,
        branchName: r.branchName ?? '-',
        processedByName: r.processedByName ?? '-',
        reason: r.reason,
        totalRefundAmount: r.totalRefundAmount,
        totalQty: Number(agg?.totalQty ?? 0),
        itemCount: Number(agg?.itemCount ?? 0),
        createdAt: toIso(r.createdAt) ?? '',
        cancelledAt: toIso(r.cancelledAt),
        cancelledByName: r.cancelledByName ?? null,
        cancelReason: r.cancelReason,
      };
    });

    return { data, total, page, totalPages, summary };
  }

  /**
   * Detail satu retur beserta itemnya. `branchId` null = boleh lintas cabang.
   */
  static async getReturnDetail(returnId: string, branchId: number | null): Promise<ReturnDetail | null> {
    const cancelledBy = alias(users, 'return_detail_cancelled_by');

    const conditions: SQL[] = [eq(returns.id, returnId)];
    if (branchId !== null) conditions.push(eq(returns.branchId, branchId));

    const [header] = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        transactionId: returns.transactionId,
        trxNumber: transactions.trxNumber,
        branchId: returns.branchId,
        branchName: branches.name,
        processedById: returns.processedById,
        processedByName: users.name,
        reason: returns.reason,
        totalRefundAmount: returns.totalRefundAmount,
        createdAt: returns.createdAt,
        cancelledAt: returns.cancelledAt,
        cancelledByName: cancelledBy.name,
        cancelReason: returns.cancelReason,
      })
      .from(returns)
      .innerJoin(transactions, eq(transactions.id, returns.transactionId))
      .leftJoin(branches, eq(branches.id, returns.branchId))
      .leftJoin(users, eq(users.id, returns.processedById))
      .leftJoin(cancelledBy, eq(cancelledBy.id, returns.cancelledById))
      .where(and(...conditions))
      .limit(1);

    if (!header) return null;

    const itemRows = await db
      .select({
        id: returnItems.id,
        productId: returnItems.productId,
        productName: products.name,
        sku: products.sku,
        uomName: unitsOfMeasure.name,
        qty: returnItems.qty,
        unitPrice: returnItems.unitPrice,
        cogs: returnItems.cogs,
        refundAmount: returnItems.refundAmount,
      })
      .from(returnItems)
      .leftJoin(products, eq(products.id, returnItems.productId))
      .leftJoin(unitsOfMeasure, eq(unitsOfMeasure.id, returnItems.uomId))
      .where(eq(returnItems.returnId, returnId))
      .orderBy(products.name);

    return {
      id: header.id,
      returnNumber: header.returnNumber,
      transactionId: header.transactionId,
      trxNumber: header.trxNumber,
      branchId: header.branchId,
      branchName: header.branchName ?? '-',
      processedById: header.processedById,
      processedByName: header.processedByName ?? '-',
      reason: header.reason,
      totalRefundAmount: header.totalRefundAmount,
      createdAt: toIso(header.createdAt) ?? '',
      cancelledAt: toIso(header.cancelledAt),
      cancelledByName: header.cancelledByName ?? null,
      cancelReason: header.cancelReason,
      items: itemRows.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName ?? 'Produk Tidak Ditemukan',
        sku: i.sku,
        uomName: i.uomName ?? '-',
        qty: i.qty,
        unitPrice: i.unitPrice,
        cogs: i.cogs,
        refundAmount: i.refundAmount,
      })),
    };
  }

  /**
   * Memproses retur dalam satu transaksi database.
   * Mencakup validasi, pencatatan retur, pembalikan stok (FIFO), dan audit log.
   */
  static async processRetur(payload: {
    transactionId: number;
    branchId: number;
    processedById: number;
    reason: string;
    items: { transactionItemId: number; qty: string }[];
  }) {
    return await db.transaction(async (tx) => {
      const itemIds = payload.items.map(i => i.transactionItemId);

      // 0. Kiriman antar cabang tidak boleh diretur dari sini. Hutangnya hidup di
      // `inter_branch_payables` yang berkunci `transfer_id`, bukan di transaksi ini, dan
      // barangnya sudah masuk stok cabang penerima saat IBT diterima. Retur di sini hanya
      // akan menambah stok cabang penjual tanpa mengurangi cabang penerima — satu barang
      // fisik tercatat di dua tempat, sementara hutang antar cabangnya tetap utuh.
      const [trxHeader] = await tx
        .select({ sourceIbtId: transactions.sourceIbtId, status: transactions.status })
        .from(transactions)
        .where(eq(transactions.id, payload.transactionId))
        .limit(1);

      if (trxHeader?.sourceIbtId != null) {
        throw new ReturError('INTER_BRANCH_SALE', PESAN_RETUR_ANTAR_CABANG);
      }
      if (trxHeader?.status === 'VOIDED') {
        throw new ReturError('TRX_VOIDED', 'Transaksi sudah dibatalkan (void), tidak ada yang bisa diretur.');
      }

      // Fetch transaction item details
      const txItems = await tx
        .select({
          id: transactionItems.id,
          productId: transactionItems.productId,
          uomId: transactionItems.uomId,
          unitPrice: transactionItems.unitPrice,
          cogs: transactionItems.cogs,
          qty: transactionItems.qty,
        })
        .from(transactionItems)
        // isRemoved difilter di sini juga, bukan hanya di daftar: item bisa saja dihapus
        // lewat koreksi transaksi setelah layar retur terbuka
        .where(and(inArray(transactionItems.id, itemIds), eq(transactionItems.isRemoved, false)));

      // Map payload items with their details
      const itemsWithDetails = payload.items.map(pItem => {
        const detail = txItems.find(ti => ti.id === pItem.transactionItemId);
        if (!detail) throw new Error(`Item transaksi ${pItem.transactionItemId} tidak ditemukan`);
        if (detail.productId === null) throw new Error(`Produk untuk item ${pItem.transactionItemId} sudah dihapus, tidak dapat diretur`);
        return { ...pItem, ...detail, productId: detail.productId, returnQty: pItem.qty };
      });

      // 1. Lock affected product stocks to prevent race conditions
      const productIds = Array.from(new Set(itemsWithDetails.map(i => i.productId)));
      if (productIds.length > 0) {
        await tx
          .select({ id: productStocks.id })
          .from(productStocks)
          .where(
            and(
              inArray(productStocks.productId, productIds),
              eq(productStocks.branchId, payload.branchId)
            )
          )
          .for('update');
      }

      // 2. Revalidate remainingQty per item
      let totalRefundAmount = new Big(0);
      for (const item of itemsWithDetails) {
        const [retRow] = await tx
          .select({ returnedQty: sql<string>`COALESCE(SUM(${returnItems.qty}), '0')` })
          .from(returnItems)
          .where(eq(returnItems.transactionItemId, item.transactionItemId));
        
        const alreadyReturned = new Big(retRow?.returnedQty || '0');
        const originalQty = new Big(item.qty);
        const remainingQty = originalQty.minus(alreadyReturned);
        
        if (new Big(item.returnQty).gt(remainingQty)) {
          throw new Error(`Kuantitas retur melebihi sisa item yang dapat dikembalikan`);
        }
        
        totalRefundAmount = totalRefundAmount.plus(new Big(item.returnQty).times(new Big(item.unitPrice)));
      }

      // 3. Generate return number with retry logic for race conditions
      let returnNumber = '';
      let attempts = 0;
      while (attempts < 3) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `RTN-${dateStr}-`;
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(returns)
          .where(like(returns.returnNumber, `${prefix}%`));
        
        const nextId = (Number(countRow?.count || 0) + 1 + attempts).toString().padStart(4, '0');
        returnNumber = `${prefix}${nextId}`;
        
        // Check if exists (additional safety)
        const [exists] = await tx
          .select({ id: returns.id })
          .from(returns)
          .where(eq(returns.returnNumber, returnNumber))
          .limit(1);
        
        if (!exists) break;
        attempts++;
      }

      const refundBulat = Math.round(totalRefundAmount.toNumber());

      // 4. Potong piutang pelanggan yang terbit dari transaksi ini.
      //
      // Barisnya dikunci lebih dulu, alasannya sama dengan void-service: pencatatan pelunasan
      // hutang membaca lalu menulis `paid_amount`/`remaining_amount` baris yang sama, jadi tanpa
      // kunci, retur dan pelunasan yang berbarengan bisa saling menimpa.
      const debtRows = await tx
        .select({
          id: customerDebts.id,
          totalAmount: customerDebts.totalAmount,
          paidAmount: customerDebts.paidAmount,
          remainingAmount: customerDebts.remainingAmount,
        })
        .from(customerDebts)
        .where(and(eq(customerDebts.transactionId, payload.transactionId), ne(customerDebts.status, 'VOIDED')))
        .for('update');

      const { potongan, totalPotongan } = hitungPemotonganPiutang(debtRows, refundBulat);

      for (const p of potongan) {
        await tx
          .update(customerDebts)
          .set({
            totalAmount: p.totalAmountBaru,
            remainingAmount: p.remainingAmountBaru,
            status: p.statusBaru,
          })
          .where(eq(customerDebts.id, p.debtId));
      }

      // 5. Insert into returns header
      const [newReturn] = await tx.insert(returns).values({
        returnNumber,
        transactionId: payload.transactionId,
        branchId: payload.branchId,
        processedById: payload.processedById,
        reason: payload.reason,
        totalRefundAmount: refundBulat,
        debtReductionAmount: totalPotongan,
      }).returning();

      // 6. Process each item for stock reversal
      for (const item of itemsWithDetails) {
        const returnQty = new Big(item.returnQty);
        
        // Insert into return_items
        await tx.insert(returnItems).values({
          returnId: newReturn.id,
          transactionItemId: item.transactionItemId,
          productId: item.productId,
          uomId: item.uomId,
          qty: Math.round(new Big(item.returnQty).toNumber()),
          unitPrice: Math.round(new Big(item.unitPrice).toNumber()),
          cogs: Math.round(new Big(item.cogs || '0').toNumber()),
          refundAmount: Math.round(returnQty.times(new Big(item.unitPrice)).toNumber()),
        });

        // 7. Stock Reversal Logic — via StockService sebagai single entry point
        // Tambahkan kembali sebagai batch FIFO baru dengan COGS asli dari transaksi
        await StockService.addStock(
          tx,
          payload.branchId,
          item.productId,
          item.uomId,
          item.returnQty,
          String(item.cogs ?? 0),
        );
      }

      // 8. Record Audit Trail
      await tx.insert(auditLogs).values({
        branchId: payload.branchId,
        userId: payload.processedById,
        action: 'RETURN_PROCESSED',
        tableName: 'returns',
        recordId: newReturn.id,
        newData: JSON.stringify({
          returnNumber,
          transactionId: payload.transactionId,
          totalRefundAmount: totalRefundAmount.toString(),
          debtReductionAmount: totalPotongan,
          cashRefundAmount: refundBulat - totalPotongan,
          items: payload.items
        }),
      });

      return {
        returnNumber,
        totalRefundAmount: refundBulat,
        debtReductionAmount: totalPotongan,
        // Yang benar-benar harus dikembalikan sebagai uang ke pelanggan. Untuk penjualan
        // kredit yang belum dibayar, angka ini 0 — tidak ada uang yang perlu berpindah.
        cashRefundAmount: refundBulat - totalPotongan,
      };
    });
  }

  static async cancelReturn(payload: {
    returnId: string;
    branchId: number;
    cancelledById: number;
    cancelReason: string;
  }) {
    return await db.transaction(async (tx) => {
      // Fetch return + validasi kepemilikan branch
      const [ret] = await tx
        .select({
          id: returns.id,
          returnNumber: returns.returnNumber,
          branchId: returns.branchId,
          transactionId: returns.transactionId,
          cancelledAt: returns.cancelledAt,
          debtReductionAmount: returns.debtReductionAmount,
        })
        .from(returns)
        .where(and(eq(returns.id, payload.returnId), eq(returns.branchId, payload.branchId)))
        .limit(1);

      if (!ret) throw new Error('Retur tidak ditemukan');
      if (ret.cancelledAt) throw new Error('Retur sudah dibatalkan sebelumnya');

      // Fetch return items untuk reversal stok
      const items = await tx
        .select({
          productId: returnItems.productId,
          uomId: returnItems.uomId,
          qty: returnItems.qty,
          cogs: returnItems.cogs,
        })
        .from(returnItems)
        .where(eq(returnItems.returnId, payload.returnId));

      if (items.length === 0) throw new Error('Item retur tidak ditemukan');

      // Pessimistic lock
      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      await tx
        .select({ id: productStocks.id })
        .from(productStocks)
        .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, payload.branchId)))
        .for('update');

      // Deduct stok kembali (balik penambahan dari retur)
      for (const item of items) {
        await StockService.deductStock(tx, payload.branchId, item.productId, item.uomId, item.qty);
      }

      // Kembalikan piutang yang dulu dipotong retur ini — persis sebesar yang tercatat,
      // bukan dihitung ulang dari keadaan sekarang.
      //
      // Kecuali transaksinya sudah di-void: void sudah menandai hutangnya VOIDED dan
      // mengosongkan sisanya, jadi menambahkannya kembali di sini akan menghidupkan lagi
      // tagihan atas transaksi yang secara resmi tidak pernah terjadi.
      let debtRestored = 0;
      if (ret.debtReductionAmount > 0) {
        const [trxHeader] = await tx
          .select({ status: transactions.status })
          .from(transactions)
          .where(eq(transactions.id, ret.transactionId))
          .limit(1);

        if (trxHeader?.status !== 'VOIDED') {
          const [debt] = await tx
            .select({
              id: customerDebts.id,
              totalAmount: customerDebts.totalAmount,
              paidAmount: customerDebts.paidAmount,
              remainingAmount: customerDebts.remainingAmount,
            })
            .from(customerDebts)
            .where(eq(customerDebts.transactionId, ret.transactionId))
            // Satu transaksi = satu baris hutang; asumsi yang sama dipakai
            // transaction-edit-service saat menyesuaikan nilai hutang.
            .limit(1)
            .for('update');

          if (debt) {
            const pulih = hitungPengembalianPiutang(debt, ret.debtReductionAmount);
            await tx
              .update(customerDebts)
              .set({
                totalAmount: pulih.totalAmountBaru,
                remainingAmount: pulih.remainingAmountBaru,
                status: pulih.statusBaru,
              })
              .where(eq(customerDebts.id, pulih.debtId));
            debtRestored = pulih.pengembalian;
          }
        }
      }

      // Soft-delete: tandai return sebagai cancelled
      await tx
        .update(returns)
        .set({
          cancelledAt: new Date(),
          cancelledById: payload.cancelledById,
          cancelReason: payload.cancelReason,
        })
        .where(eq(returns.id, payload.returnId));

      // Audit log
      await tx.insert(auditLogs).values({
        branchId: payload.branchId,
        userId: payload.cancelledById,
        action: 'RETURN_CANCELLED',
        tableName: 'returns',
        recordId: payload.returnId,
        newData: JSON.stringify({
          returnNumber: ret.returnNumber,
          cancelReason: payload.cancelReason,
          debtRestoredAmount: debtRestored,
        }),
      });

      return { returnNumber: ret.returnNumber, debtRestoredAmount: debtRestored };
    });
  }
}
