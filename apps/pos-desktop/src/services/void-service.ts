// apps/pos-desktop/src/services/void-service.ts
import { getDb } from '@/lib/db'
import type { LocalTransaction } from '@/lib/db'

export const voidService = {
  async voidTransaction(transactionId: number): Promise<LocalTransaction> {
    const db = await getDb()

    return await db.transaction('rw', [db.localTransactions, db.pendingOperations], async () => {
      const trx = await db.localTransactions.get(transactionId)
      if (!trx) throw new Error('Transaksi tidak ditemukan.')
      if (trx.status === 'VOID') throw new Error('Transaksi sudah dibatalkan.')

      await db.localTransactions.update(transactionId, { status: 'VOID' })

      await db.pendingOperations.add({
        id: typeof crypto.randomUUID === 'function' 
          ? crypto.randomUUID() 
          : Date.now().toString(36) + Math.random().toString(36).substring(2),
        type: 'VOID_TRANSACTION',
        payload: {
          transactionId,
          trxNumber: trx.trxNumber,
          voidedAt: Date.now(),
        },
        createdAt: Date.now(),
        retryCount: 0,
      })

      return { ...trx, status: 'VOID' as const }
    })
  },
}
