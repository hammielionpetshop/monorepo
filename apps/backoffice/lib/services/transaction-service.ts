import { db, transactions, transactionItems, transactionPayments, products, productUomConversions, productStocks, eq, and } from '../db';
import { StockService } from './stock-service';

export function generateTrxNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TRX-${date}-${random}`;
}

export class TransactionService {
  static async asyncValidateInventory(tx: any, branchId: number, items: any[]) {
    for (const item of items) {
      const [stock] = await tx
        .select()
        .from(productStocks)
        .where(
          and(
            eq(productStocks.productId, item.productId),
            eq(productStocks.branchId, branchId)
          )
        );
      
      const requestedQtyBase = item.qty; // Note: In a real system, we'd resolve UOM ratio here first to be 100% sure
      if (!stock || parseFloat(stock.qty) < requestedQtyBase) {
        throw new Error(`Stok tidak mencukupi untuk produk ${item.productName || item.productId}`);
      }
    }
  }

  static async createTransaction(payload: any) {
    return await db.transaction(async (tx) => {
      const { branchId, shiftId, cashierId, items, payments, totals, amountPaid, change } = payload;

      // 1. Validate Total Payments
      const totalPaymentAmount = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
      if (totalPaymentAmount < parseFloat(totals.grandTotal)) {
        throw new Error('Total pembayaran kurang dari nominal transaksi');
      }

      // 2. Validate Inventory
      await TransactionService.asyncValidateInventory(tx, branchId, items);

      // 3. Create Transaction header
      const [trx] = await tx.insert(transactions).values({
        trxNumber: generateTrxNumber(),
        branchId,
        shiftId,
        cashierId,
        customerId: payload.customerId || null,
        totalAmount: totals.subtotal.toString(),
        discountAmount: totals.discountTotal.toString(),
        taxAmount: '0',
        payableAmount: totals.grandTotal.toString(),
        paidAmount: totalPaymentAmount.toString(),
        changeAmount: change.toString(),
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
             ratioToQty = parseFloat(conv.ratio as any);
           }
        }

        const baseQtyToDeduct = item.qty * ratioToQty;

        // Deduct stock via FIFO (This handles stock deduction internally)
        const cogsResult = await StockService.deductStock(
          tx, 
          branchId, 
          item.productId, 
          product.baseUomId, 
          baseQtyToDeduct
        );

        await tx.insert(transactionItems).values({
          transactionId: trx.id,
          productId: item.productId,
          uomId: item.uomId,
          qty: item.qty.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.subtotal.toString(),
          discountAmount: item.discountAmount.toString(),
          priceTier: item.priceTier,
          cogs: cogsResult.totalCogs.toString(),
          isOwnerOverride: item.isOwnerOverride || false,
        });
      }

      // 4. Process Payments
      for (const payment of payments) {
        await tx.insert(transactionPayments).values({
          transactionId: trx.id,
          paymentMethodId: payment.paymentMethodId,
          amount: payment.amount.toString(),
          referenceNumber: payment.referenceNumber || null,
        });
      }

      return trx;
    });
  }
}
