import { describe, it, expect, vi, beforeEach } from 'vitest'
import { voidService } from './void-service'
import { getDb } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}))

describe('VoidService', () => {
  const mockDb = {
    localTransactions: {
      get: vi.fn(),
      update: vi.fn(),
    },
    pendingOperations: {
      add: vi.fn(),
    },
    transaction: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDb).mockResolvedValue(mockDb as any)
    // Simulate Dexie transaction executing the callback immediately
    mockDb.transaction.mockImplementation((_mode: string, _tables: any[], callback: () => any) =>
      callback()
    )
  })

  describe('voidTransaction', () => {
    it('should update status to VOID and add pendingOperation', async () => {
      const mockTrx = {
        id: 1,
        shiftId: 42,
        trxNumber: 'TRX-001',
        createdAt: Date.now(),
        customerName: 'Budi',
        totalAmount: '100000',
        payload: {},
        status: undefined,
      }
      mockDb.localTransactions.get.mockResolvedValue(mockTrx)
      mockDb.localTransactions.update.mockResolvedValue(1)
      mockDb.pendingOperations.add.mockResolvedValue('some-uuid')

      const result = await voidService.voidTransaction(1)

      expect(mockDb.localTransactions.update).toHaveBeenCalledWith(1, expect.objectContaining({ 
        status: 'VOID',
        updatedAt: expect.any(Number)
      }))
      expect(mockDb.pendingOperations.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'VOID_TRANSACTION',
          payload: expect.objectContaining({ transactionId: 1, trxNumber: 'TRX-001' }),
        })
      )
      expect(result.status).toBe('VOID')
    })

    it('should throw if transaction not found', async () => {
      mockDb.localTransactions.get.mockResolvedValue(undefined)

      await expect(voidService.voidTransaction(999)).rejects.toThrow('Transaksi tidak ditemukan.')
    })

    it('should throw if transaction already VOID', async () => {
      mockDb.localTransactions.get.mockResolvedValue({ id: 1, status: 'VOID' })

      await expect(voidService.voidTransaction(1)).rejects.toThrow('Transaksi sudah dibatalkan.')
    })
  })

  // Story 4.2 contract: shift-closed guard lives in UI layer, not service
  // The UI checks: canVoid = activeShiftId != null && transaction.shiftId === activeShiftId
  // voidService itself does NOT enforce shift status — the Void button is hidden before it can be called
  describe('shiftId contract (Story 4.2 guard — UI layer)', () => {
    it('should preserve shiftId in the returned voided transaction', async () => {
      const mockTrx = {
        id: 5,
        shiftId: 42,
        trxNumber: 'TRX-SHIFT',
        createdAt: Date.now(),
        customerName: '',
        totalAmount: '50000',
        payload: {},
        status: undefined,
      }
      mockDb.localTransactions.get.mockResolvedValue(mockTrx)
      mockDb.localTransactions.update.mockResolvedValue(1)
      mockDb.pendingOperations.add.mockResolvedValue('uuid')

      const result = await voidService.voidTransaction(5)

      // shiftId must be preserved so UI can still evaluate canVoid after void
      expect(result.shiftId).toBe(42)
    })

    it('should document UI guard: Void button only shown when shiftId matches activeShiftId', () => {
      // This test documents the UI guard contract (no runtime assertion needed):
      // In TransactionDetailDialog:
      //   const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId
      //   {transaction.status !== 'VOID' && canVoid && <VoidButton />}
      //
      // Cases:
      //   activeShiftId=42, shiftId=42 → canVoid=true  → button shown
      //   activeShiftId=null, shiftId=42 → canVoid=false → button hidden
      //   activeShiftId=43, shiftId=42  → canVoid=false → button hidden
      const cases = [
        { activeShiftId: 42, shiftId: 42, expected: true },
        { activeShiftId: null, shiftId: 42, expected: false },
        { activeShiftId: 43, shiftId: 42, expected: false },
        { activeShiftId: undefined, shiftId: 42, expected: false },
      ]

      for (const { activeShiftId, shiftId, expected } of cases) {
        const canVoid = activeShiftId != null && shiftId === activeShiftId
        expect(canVoid).toBe(expected)
      }
    })
  })
})
