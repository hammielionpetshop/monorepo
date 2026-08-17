import { describe, expect, it, vi } from 'vitest'

// Hanya `db` yang dipalsukan (butuh DATABASE_URL); yang diuji di sini murni penjaga aturannya.
vi.mock('@/lib/db', () => ({
  db: {},
  shiftExpenses: {},
  shifts: {},
  users: {},
  branches: {},
  expenseCategories: {},
  auditLogs: {},
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
}))

const { assertMutable, ShiftExpenseServiceError } = await import('./shift-expense-service')

const OPEN = { branchId: 1, shiftStatus: 'OPEN' }

describe('assertMutable — pengeluaran hanya boleh diubah selama shift berjalan', () => {
  it('mengizinkan pengeluaran di shift yang masih OPEN', () => {
    expect(() => assertMutable(OPEN)).not.toThrow()
    expect(() => assertMutable(OPEN, 1)).not.toThrow()
  })

  // Setelah settlement, nominalnya sudah ikut terhitung ke breakdown dan kas yang diharapkan.
  // Mengubahnya membuat total di laporan tidak lagi cocok dengan rinciannya.
  it.each(['CLOSED', 'FORCE_CLOSED'])('menolak shift %s', (status) => {
    try {
      assertMutable({ branchId: 1, shiftStatus: status })
      throw new Error('seharusnya melempar')
    } catch (error) {
      expect(error).toBeInstanceOf(ShiftExpenseServiceError)
      expect((error as InstanceType<typeof ShiftExpenseServiceError>).code).toBe('SHIFT_CLOSED')
    }
  })

  it('menolak pengeluaran cabang lain saat scope user dibatasi', () => {
    try {
      assertMutable(OPEN, 2)
      throw new Error('seharusnya melempar')
    } catch (error) {
      expect(error).toBeInstanceOf(ShiftExpenseServiceError)
      expect((error as InstanceType<typeof ShiftExpenseServiceError>).code).toBe('OUT_OF_SCOPE')
    }
  })

  // Cabang diperiksa lebih dulu: user lintas-cabang tidak boleh diberi tahu status shift
  // cabang yang bukan haknya, bahkan lewat perbedaan pesan error.
  it('mengutamakan penolakan cabang di atas status shift', () => {
    try {
      assertMutable({ branchId: 1, shiftStatus: 'CLOSED' }, 2)
      throw new Error('seharusnya melempar')
    } catch (error) {
      expect((error as InstanceType<typeof ShiftExpenseServiceError>).code).toBe('OUT_OF_SCOPE')
    }
  })

  it('tidak membatasi cabang saat allowedBranchId tidak diberikan (scope ALL)', () => {
    expect(() => assertMutable({ branchId: 99, shiftStatus: 'OPEN' })).not.toThrow()
  })
})
