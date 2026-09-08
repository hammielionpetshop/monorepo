import { describe, expect, it, vi } from 'vitest'

// Hanya `db` yang dipalsukan (butuh DATABASE_URL); yang diuji di sini murni rumus hitungnya.
vi.mock('@/lib/db', () => ({
  db: {},
  shiftCashierSessions: {},
  transactions: {},
  transactionPayments: {},
  paymentMethods: {},
  shiftExpenses: {},
  users: {},
  debtPayments: {},
  customerDebts: {},
  customers: {},
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
}))

const { aggregateShiftBreakdown } = await import('./shift-live-breakdown')

const ANDI = { id: 1, name: 'Andi' }
const BUDI = { id: 2, name: 'Budi' }

describe('aggregateShiftBreakdown — estimasi shift yang belum settle', () => {
  it('memisahkan penjualan per metode bayar dan mengurangi kembalian dari kas', () => {
    const [b] = aggregateShiftBreakdown({
      cashiers: [ANDI],
      transactions: [{ cashierId: 1, changeAmount: 5000, discountAmount: 2000 }],
      payments: [
        { cashierId: 1, amount: 100000, type: 'CASH' },
        { cashierId: 1, amount: 50000, type: 'QRIS' },
        { cashierId: 1, amount: 25000, type: 'BANK_TRANSFER' },
        { cashierId: 1, amount: 10000, type: 'E_WALLET' },
        { cashierId: 1, amount: 30000, type: 'DEBT' },
      ],
      expenses: [{ cashierId: 1, amount: 20000 }],
    })

    expect(b.totalSalesCash).toBe(95000) // 100.000 − kembalian 5.000
    expect(b.totalSalesQris).toBe(50000)
    expect(b.totalSalesDebit).toBe(25000)
    expect(b.totalSalesCredit).toBe(10000) // e-wallet & non-tunai lain
    expect(b.totalSalesDebt).toBe(30000)
    expect(b.totalSales).toBe(210000) // 215.000 − kembalian 5.000
    expect(b.totalDiscount).toBe(2000)
    expect(b.totalTransactions).toBe(1)
    expect(b.totalExpenses).toBe(20000)
    expect(b.expectedCash).toBe(75000) // kas penjualan − pengeluaran, modal tidak ikut
  })

  it('tidak mencampur angka antar kasir dalam satu shift', () => {
    const rows = aggregateShiftBreakdown({
      cashiers: [ANDI, BUDI],
      transactions: [
        { cashierId: 1, changeAmount: 0, discountAmount: 0 },
        { cashierId: 2, changeAmount: 0, discountAmount: 0 },
      ],
      payments: [
        { cashierId: 1, amount: 100000, type: 'CASH' },
        { cashierId: 2, amount: 70000, type: 'CASH' },
      ],
      expenses: [{ cashierId: 2, amount: 10000 }],
    })

    expect(rows.map((r) => [r.cashierName, r.expectedCash])).toEqual([
      ['Andi', 100000],
      ['Budi', 60000],
    ])
  })

  // Kasir yang gabung shift tapi belum menjual apa pun hanya jadi baris nol yang membingungkan.
  it('menyembunyikan kasir tanpa transaksi & tanpa pengeluaran', () => {
    const rows = aggregateShiftBreakdown({
      cashiers: [ANDI, BUDI],
      transactions: [{ cashierId: 1, changeAmount: 0, discountAmount: 0 }],
      payments: [{ cashierId: 1, amount: 50000, type: 'CASH' }],
      expenses: [],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].cashierId).toBe(1)
  })

  // Kasir bisa punya pengeluaran tanpa penjualan — kasnya minus dan itu harus terlihat.
  it('tetap menampilkan kasir yang hanya punya pengeluaran', () => {
    const [b] = aggregateShiftBreakdown({
      cashiers: [ANDI],
      transactions: [],
      payments: [],
      expenses: [{ cashierId: 1, amount: 15000 }],
    })

    expect(b.totalTransactions).toBe(0)
    expect(b.expectedCash).toBe(-15000)
  })

  // Belum settle: tidak ada kas fisik yang dihitung, jadi tidak boleh ada klaim selisih.
  it('tidak menandai selisih karena shift belum ditutup', () => {
    const [b] = aggregateShiftBreakdown({
      cashiers: [ANDI],
      transactions: [{ cashierId: 1, changeAmount: 0, discountAmount: 0 }],
      payments: [{ cashierId: 1, amount: 50000, type: 'CASH' }],
      expenses: [],
    })

    expect(b.isVarianceFlagged).toBe(false)
  })
})
