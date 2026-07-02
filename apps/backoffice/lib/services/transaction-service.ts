import { db, transactions, transactionItems, transactionPayments, paymentMethods, customerDebts, products, productUomConversions, productStockBatches, productStocks, auditLogs, eq, and, inArray, sql } from '../db';
import { StockService } from './stock-service';

export function generateTrxNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TRX-${date}-${random}`;
}

export class TransactionService {
  static async createTransaction(payload: any) {
    return await db.transaction(async (tx) => {
      const { branchId, shiftId, cashierId, items, payments, totals, amountPaid, change } = payload;

      // 1. Validate Total Payments
      const totalPaymentAmount = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      if (totalPaymentAmount < Number(totals.grandTotal)) {
        throw new Error('Total pembayaran kurang dari nominal transaksi');
      }

      // 2. Validasi stok TIDAK memblokir — penjualan produk stok 0 diizinkan
      //    (oversell), stok minus tetap tercatat di productStocks. Peringatan
      //    ditampilkan di sisi kasir, bukan di sini.

      // 3. Create Transaction header
      const [trx] = await tx.insert(transactions).values({
        trxNumber: payload.localTrxNumber || generateTrxNumber(),
        branchId,
        shiftId,
        cashierId,
        customerId: payload.customerId || null,
        totalAmount: Math.round(Number(totals.subtotal)),
        discountAmount: Math.round(Number(totals.discountTotal)),
        taxAmount: 0,
        payableAmount: Math.round(Number(totals.grandTotal)),
        paidAmount: Math.round(Number(totalPaymentAmount)),
        changeAmount: Math.round(Number(change)),
        status: 'COMPLETED',
        createdOffline: payload.createdOffline ?? false,
        offlineTimestamp: payload.offlineTimestamp ?? null,
      }).returning();

      // 3. Pre-fetch products, conversions, stock batches, and stock aggregates
      const productIds: number[] = Array.from(new Set(items.map((item: any) => Number(item.productId))));
      
      const fetchedProducts = productIds.length > 0 ? await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds)) : [];
      const productsMap = new Map(fetchedProducts.map((p: any) => [p.id, p]));

      const fetchedConversions = productIds.length > 0 ? await tx
        .select()
        .from(productUomConversions)
        .where(inArray(productUomConversions.productId, productIds)) : [];
      const conversionsMap = new Map(
        fetchedConversions.map((c: any) => [`${c.productId}_${c.uomId}`, c])
      );

      const fetchedBatches = productIds.length > 0 ? await tx
        .select()
        .from(productStockBatches)
        .where(
          and(
            eq(productStockBatches.branchId, branchId),
            inArray(productStockBatches.productId, productIds),
            sql`${productStockBatches.qtyRemaining} > 0`
          )
        )
        .orderBy(productStockBatches.receivedAt) : [];
      const batchesMap = new Map<number, any[]>();
      for (const b of fetchedBatches) {
        const arr = batchesMap.get(b.productId) ?? [];
        arr.push(b);
        batchesMap.set(b.productId, arr);
      }

      const fetchedStocks = productIds.length > 0 ? await tx
        .select()
        .from(productStocks)
        .where(
          and(
            eq(productStocks.branchId, branchId),
            inArray(productStocks.productId, productIds)
          )
        ) : [];
      const stocksMap = new Map(
        fetchedStocks.map((s: any) => [`${s.productId}_${s.uomId}`, s])
      );

      const itemsToInsert = [];
      // Item yang terjual melebihi stok (oversell) — dicatat ke audit log untuk ditinjau owner
      const oversellItems: { productId: number; productName: string; sku: string | null; qtyShortBase: number }[] = [];

      for (const item of items) {
        const product = productsMap.get(Number(item.productId));
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        const baseUomId = product.baseUomId;
        let ratioToQty = 1;
        if (item.uomId !== baseUomId) {
          const conv = conversionsMap.get(`${item.productId}_${item.uomId}`);
          if (conv) {
            ratioToQty = Number(conv.ratio);
          }
        }

        const baseQtyToDeduct = item.qty * ratioToQty;

        // Deduct stock via FIFO using pre-fetched caches
        const productBatches = batchesMap.get(Number(item.productId)) ?? [];
        const existingStock = stocksMap.get(`${item.productId}_${baseUomId}`);

        const cogsResult = await StockService.deductStock(
          tx,
          branchId,
          item.productId,
          baseUomId,
          baseQtyToDeduct,
          true,
          {
            product,
            ratio: ratioToQty,
            batches: productBatches,
            existingStock: existingStock || null,
            onStockCreated: (newStock) => {
              stocksMap.set(`${item.productId}_${baseUomId}`, newStock);
            }
          }
        );

        const qtyShortBase = Number(cogsResult.shortfallQty ?? 0);
        if (qtyShortBase > 0) {
          oversellItems.push({
            productId: Number(item.productId),
            productName: product.name,
            sku: product.sku ?? null,
            qtyShortBase,
          });
        }

        itemsToInsert.push({
          transactionId: trx.id,
          productId: item.productId,
          productName: product.name,
          productSku: product.sku,
          uomId: item.uomId,
          qty: Math.round(Number(item.qty)),
          unitPrice: Math.round(Number(item.unitPrice)),
          totalPrice: Math.round(Number(item.subtotal)),
          discountAmount: Math.round(Number(item.discountAmount)),
          priceTier: item.priceTier,
          cogs: Math.round(Number(cogsResult.totalCogs)),
        });
      }

      // Batch insert transaction items
      if (itemsToInsert.length > 0) {
        await tx.insert(transactionItems).values(itemsToInsert);
      }

      // Catat kejadian oversell (stok terjual melebihi persediaan) untuk ditinjau owner.
      // qtyShortBase dalam base UOM. authorizedOversell = disetujui PIN di POS desktop.
      if (oversellItems.length > 0) {
        await tx.insert(auditLogs).values({
          branchId,
          userId: cashierId ?? null,
          action: 'OVERSELL',
          tableName: 'transactions',
          recordId: String(trx.id),
          newData: JSON.stringify({
            trxNumber: trx.trxNumber,
            authorizedOversell: payload.authorizedOversell === true,
            items: oversellItems,
          }),
        });
      }

      // 4. Process Payments
      if (payments.length > 0) {
        const paymentsToInsert = payments.map((payment: any) => ({
          transactionId: trx.id,
          paymentMethodId: payment.paymentMethodId,
          amount: Math.round(Number(payment.amount)),
          referenceNumber: payment.referenceNumber || null,
        }));
        await tx.insert(transactionPayments).values(paymentsToInsert);
      }

      // 5. Catat hutang — baris pembayaran bertipe DEBT dianggap jumlah yang dihutang
      const paymentMethodIds: number[] = Array.from(new Set(payments.map((p: any) => Number(p.paymentMethodId))));
      const methodRows = await tx
        .select({ id: paymentMethods.id, type: paymentMethods.type })
        .from(paymentMethods)
        .where(inArray(paymentMethods.id, paymentMethodIds));
      const typeById = new Map(methodRows.map((m: any) => [m.id, m.type]));

      const debtAmount = payments.reduce(
        (sum: number, p: any) => sum + (typeById.get(Number(p.paymentMethodId)) === 'DEBT' ? Math.round(Number(p.amount)) : 0),
        0
      );

      if (debtAmount > 0) {
        if (!payload.customerId) {
          throw new Error('CUSTOMER_REQUIRED_FOR_DEBT');
        }
        const parsedDue = payload.dueAt ? new Date(payload.dueAt) : null;
        const dueAt = parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue : null;
        await tx.insert(customerDebts).values({
          customerId: payload.customerId,
          transactionId: trx.id,
          branchId,
          totalAmount: debtAmount,
          paidAmount: 0,
          remainingAmount: debtAmount,
          status: 'UNPAID',
          dueAt,
          createdBy: cashierId ?? null,
        });
      }

      return trx;
    });
  }
}
