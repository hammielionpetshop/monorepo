import { StockService } from './stock-service';
import {
  db,
  transactions,
  transactionItems,
  returns,
  returnItems,
  products,
  productStocks,
  auditLogs,
  eq,
  and,
  sql,
  like,
  inArray,
} from '../db';
import Big from 'big.js';

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
};

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
      .where(eq(transactionItems.transactionId, trx.id))
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
        .where(inArray(transactionItems.id, itemIds));

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

      // 4. Insert into returns header
      const [newReturn] = await tx.insert(returns).values({
        returnNumber,
        transactionId: payload.transactionId,
        branchId: payload.branchId,
        processedById: payload.processedById,
        reason: payload.reason,
        totalRefundAmount: Math.round(totalRefundAmount.toNumber()),
      }).returning();

      // 5. Process each item for stock reversal
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

        // 6. Stock Reversal Logic — via StockService sebagai single entry point
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

      // 7. Record Audit Trail
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
          items: payload.items 
        }),
      });

      return { returnNumber };
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
          cancelledAt: returns.cancelledAt,
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
        newData: JSON.stringify({ returnNumber: ret.returnNumber, cancelReason: payload.cancelReason }),
      });

      return { returnNumber: ret.returnNumber };
    });
  }
}
