import { getDb } from '@/lib/db'
import type { LocalTransaction } from '@/lib/db'

function getDayRange(date: Date): { startMs: number; endMs: number } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

export const historyService = {
  async getTodayTransactions(): Promise<LocalTransaction[]> {
    return historyService.getTransactionsByDate(new Date())
  },

  async getTransactionsByDate(date: Date): Promise<LocalTransaction[]> {
    const db = await getDb()
    const { startMs, endMs } = getDayRange(date)
    try {
      // where('createdAt') menggunakan index — O(log n), memenuhi NFR-P1 < 200ms
      return await db.localTransactions
        .where('createdAt')
        .between(startMs, endMs, true, true)
        .reverse() // descending: terbaru di atas
        .toArray()
    } catch (error) {
      throw new Error('Gagal memuat riwayat transaksi.', { cause: error })
    }
  },
}
