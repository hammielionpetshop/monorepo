import { NextResponse } from 'next/server';
import { TransactionService } from '@/lib/services/transaction-service';
import { z } from 'zod';

const syncItemSchema = z.object({
  id: z.string(),           // PendingOperation.id dari Dexie (UUID string)
  payload: z.object({
    branchId: z.number(),
    shiftId: z.number(),
    cashierId: z.number().nullable(),
    customerId: z.number().nullable().optional(),
    items: z.array(z.object({
      productId: z.number(),
      productName: z.string(),
      uomId: z.number(),
      uomCode: z.string(),
      qty: z.number().positive(),
      unitPrice: z.number(),      // ADR-003: price-at-time-of-sale dari POS
      priceTier: z.string(),
      discountAmount: z.number(),
      subtotal: z.number(),
      isOwnerOverride: z.boolean(),
    })).min(1),
    totals: z.object({
      subtotal: z.number(),
      discountTotal: z.number(),
      grandTotal: z.number(),
      itemCount: z.number().optional(),
    }),
    amountPaid: z.number(),
    change: z.number(),
    payments: z.array(z.object({
      paymentMethodId: z.number(),
      amount: z.number(),
      referenceNumber: z.string().nullable().optional(),
    })),
    offlineAt: z.number(),        // Unix timestamp ms saat transaksi offline
    localTrxNumber: z.string().optional(),
  }),
});

const batchSyncSchema = z.object({
  deviceId: z.string(),
  transactions: z.array(syncItemSchema).min(1).max(100), // max 100 per batch
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = batchSyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload tidak valid', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { transactions } = parsed.data;
    const synced: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    // Proses satu per satu — error satu item TIDAK menghentikan item berikutnya
    for (const item of transactions) {
      try {
        const cashierId = item.payload.cashierId;
        if (!cashierId) {
          throw new Error('Data transaksi offline tidak memiliki Cashier ID yang valid');
        }

        await TransactionService.createTransaction({
          ...item.payload,
          cashierId: cashierId,
          createdOffline: true,
          offlineTimestamp: new Date(item.payload.offlineAt),
        });
        synced.push(item.id);
      } catch (err: any) {
        console.error(`[Sync] Gagal memproses transaksi ${item.id}:`, err);
        failed.push({
          id: item.id,
          reason: err.message || 'Gagal memproses transaksi offline',
        });
      }
    }

    return NextResponse.json({ synced, failed });
  } catch (error: any) {
    console.error('[Sync] Batch error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses batch sinkronisasi' },
      { status: 500 }
    );
  }
}
