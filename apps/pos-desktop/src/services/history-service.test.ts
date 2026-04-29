import { describe, it, expect, vi, beforeEach } from 'vitest'
import { historyService } from './history-service'
import { getDb } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}))

describe('HistoryService', () => {
  const mockDb = {
    localTransactions: {
      where: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDb).mockResolvedValue(mockDb as any)
  })

  describe('getTodayTransactions', () => {
    it('should return transactions for today only', async () => {
      const mockData = [
        { id: 1, trxNumber: 'TRX-001', createdAt: Date.now(), totalAmount: '100', payload: {} },
      ]
      mockDb.localTransactions.toArray.mockResolvedValue(mockData)

      const result = await historyService.getTodayTransactions()

      expect(result).toEqual(mockData)
      expect(mockDb.localTransactions.where).toHaveBeenCalledWith('createdAt')
      // verify that between is called with correct range for today
      const [startMs, endMs] = mockDb.localTransactions.between.mock.calls[0]
      const start = new Date(startMs)
      const end = new Date(endMs)
      
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
    })

    it('should return empty array if no transactions today', async () => {
      mockDb.localTransactions.toArray.mockResolvedValue([])

      const result = await historyService.getTodayTransactions()

      expect(result).toEqual([])
    })

    it('should call reverse to get descending order', async () => {
      mockDb.localTransactions.toArray.mockResolvedValue([])
      await historyService.getTodayTransactions()
      expect(mockDb.localTransactions.reverse).toHaveBeenCalled()
    })
  })

  describe('getTransactionsByDate', () => {
    it('should return transactions for a specific date', async () => {
      const specificDate = new Date('2026-04-20T10:00:00')
      const mockData = [
        { id: 2, trxNumber: 'TRX-OLD', createdAt: specificDate.getTime(), totalAmount: '50', payload: {} },
      ]
      mockDb.localTransactions.toArray.mockResolvedValue(mockData)

      const result = await historyService.getTransactionsByDate(specificDate)

      expect(result).toEqual(mockData)
      
      const [startMs] = mockDb.localTransactions.between.mock.calls[0]
      const start = new Date(startMs)
      expect(start.getFullYear()).toBe(2026)
      expect(start.getMonth()).toBe(3) // April is 3
      expect(start.getDate()).toBe(20)
      expect(start.getHours()).toBe(0)
    })

    it('should return empty array when no transactions on selected date', async () => {
      mockDb.localTransactions.toArray.mockResolvedValue([])
      const result = await historyService.getTransactionsByDate(new Date('2026-01-01T00:00:00'))
      expect(result).toEqual([])
    })
  })

  describe('searchByCustomerName', () => {
    it('should filter transactions by customer name (partial match, case insensitive)', async () => {
      const mockData = [
        { id: 1, customerName: 'Budi Santoso', createdAt: Date.now() },
        { id: 2, customerName: 'Andi Budiman', createdAt: Date.now() },
        { id: 3, customerName: 'Charlie', createdAt: Date.now() },
      ]
      mockDb.localTransactions.toArray.mockResolvedValue(mockData)

      const result = await historyService.searchByCustomerName('budi')

      expect(result).toHaveLength(2)
      expect(result[0].customerName).toBe('Budi Santoso')
      expect(result[1].customerName).toBe('Andi Budiman')
    })

    it('should return empty array if no matches found', async () => {
      const mockData = [
        { id: 1, customerName: 'Budi', createdAt: Date.now() },
      ]
      mockDb.localTransactions.toArray.mockResolvedValue(mockData)

      const result = await historyService.searchByCustomerName('zara')

      expect(result).toHaveLength(0)
    })

    it('should return all transactions if keyword is empty', async () => {
      const mockData = [
        { id: 1, customerName: 'Budi', createdAt: Date.now() },
      ]
      mockDb.localTransactions.toArray.mockResolvedValue(mockData)

      const result = await historyService.searchByCustomerName('')

      expect(result).toEqual(mockData)
      // Should fallback to getTransactionsByDate which calls reverse()
      expect(mockDb.localTransactions.reverse).toHaveBeenCalled()
    })

    it('should handle null or undefined customer names safely', async () => {
      const mockData = [
        { id: 1, customerName: null, createdAt: Date.now() },
        { id: 2, customerName: undefined, createdAt: Date.now() },
        { id: 3, customerName: 'Budi', createdAt: Date.now() },
      ]
      mockDb.localTransactions.toArray.mockResolvedValue(mockData)

      const result = await historyService.searchByCustomerName('budi')

      expect(result).toHaveLength(1)
      expect(result[0].customerName).toBe('Budi')
    })
  })
})
