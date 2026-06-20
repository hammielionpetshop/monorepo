import { db, transactions, transactionItems, transactionPayments, paymentMethods, customerDebts, products, productUomConversions, eq, and, inArray } from '../db';
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

      // 3. Process Items
      for (const item of items) {
        // Find product base UOM
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
        
        // Determine ratio from purchased UOM -> base UOM
        let ratioToQty = 1;
        if (item.uomId !== product.baseUomId) {
           const [conv] = await tx.select().from(productUomConversions).where(
             and(eq(productUomConversions.productId, item.productId), eq(productUomConversions.uomId, item.uomId))
           );
           if (conv) {
             ratioToQty = Number(conv.ratio);
           }
        }

        const baseQtyToDeduct = item.qty * ratioToQty;

        // Deduct stock via FIFO — allowNegative: oversell diizinkan, stok minus tercatat
        const cogsResult = await StockService.deductStock(
          tx,
          branchId,
          item.productId,
          product.baseUomId,
          baseQtyToDeduct,
          true
        );

        await tx.insert(transactionItems).values({
          transactionId: trx.id,
          productId: item.productId,
          uomId: item.uomId,
          qty: Math.round(Number(item.qty)),
          unitPrice: Math.round(Number(item.unitPrice)),
          totalPrice: Math.round(Number(item.subtotal)),
          discountAmount: Math.round(Number(item.discountAmount)),
          priceTier: item.priceTier,
          cogs: Math.round(Number(cogsResult.totalCogs)),
        });
      }

      // 4. Process Payments
      for (const payment of payments) {
        await tx.insert(transactionPayments).values({
          transactionId: trx.id,
          paymentMethodId: payment.paymentMethodId,
          amount: Math.round(Number(payment.amount)),
          referenceNumber: payment.referenceNumber || null,
        });
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
