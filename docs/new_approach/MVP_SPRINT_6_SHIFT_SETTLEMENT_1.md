# 📘 MVP SPRINT 6 - SHIFT & SETTLEMENT MULTI-KASIR

**Sprint Duration**: 2 weeks (Week 11-12)  
**Sprint Goal**: Shift management + Multi-kasir settlement + Daily expenses  
**Story Points**: 27 points  
**Team**: 2-3 developers

---

## 🎯 SPRINT OBJECTIVES

By end of Sprint 6, system harus bisa:
1. ✅ Open shift (Manager/Owner)
2. ✅ Close shift (Manager/Owner)
3. ✅ Multi-kasir per shift (2-3 kasir concurrent)
4. ✅ Settlement breakdown per kasir
5. ✅ Input daily expenses saat settlement
6. ✅ Calculate variance per kasir
7. ✅ Settlement report

---

## 📋 USER STORIES

### **Story 6.1: Open Shift (Manager/Owner)**

**As a** Manager Toko  
**I want to** open shift di awal hari  
**So that** kasir bisa mulai checkout customer

**Story Points**: 5

#### Acceptance Criteria
```
✅ Open shift page accessible di `/pos/shift/open`
✅ Pre-conditions:
   - Only Manager/Owner can open shift
   - Cannot open new shift if previous shift masih open
   - 1 shift per cabang per hari (di MVP)

✅ Open shift form:
   - Shift date: [Auto-fill today]
   - Modal awal: [Rp 200.000] (default, editable)
   - Opened by: [Auto-fill logged-in user]
   - Confirm button

✅ Open shift action:
   - Create shift record:
     * branch_id
     * shift_date (today)
     * opened_by (user_id)
     * opened_at (timestamp)
     * modal_awal (default Rp 200k)
     * status: 'open'
   - Redirect to POS checkout
   - Show notification: "Shift opened. Modal awal: Rp 200.000"

✅ Validation:
   - Cannot open 2 shift di hari yang sama
   - Modal awal must be >= 0
   - Manager/Owner role required

✅ Error handling:
   - IF previous shift not closed → Error: "Shift kemarin belum ditutup. Close dulu."
```

#### Technical Tasks
- [ ] Create `/app/pos/shift/open/page.tsx`
- [ ] Create OpenShiftForm component
- [ ] Create API endpoint:
  - `POST /api/pos/shift/open`
- [ ] Implement shift validation (no duplicate shift)
- [ ] Test open shift

#### Component Example
```tsx
// app/pos/shift/open/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OpenShiftPage() {
  const router = useRouter()
  const [modalAwal, setModalAwal] = useState(200000)
  const [loading, setLoading] = useState(false)
  const [currentShift, setCurrentShift] = useState<any>(null)

  useEffect(() => {
    checkCurrentShift()
  }, [])

  const checkCurrentShift = async () => {
    // Check if shift already open today
    const res = await fetch('/api/pos/shift/current')
    const data = await res.json()
    
    if (data.shift) {
      setCurrentShift(data.shift)
    }
  }

  const handleOpenShift = async () => {
    if (!confirm(`Open shift dengan modal awal Rp ${modalAwal.toLocaleString('id-ID')}?`)) {
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/pos/shift/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modal_awal: modalAwal })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      const data = await res.json()
      alert('Shift berhasil dibuka!')
      router.push('/pos/checkout')
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (currentShift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">Shift Sudah Dibuka</h1>
            <p className="text-gray-600">Shift hari ini sudah aktif</p>
          </div>

          <div className="bg-gray-50 p-4 rounded mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Opened by:</span>
              <span className="font-medium">{currentShift.opened_by_user.name}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Opened at:</span>
              <span className="font-medium">
                {new Date(currentShift.opened_at).toLocaleTimeString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Modal awal:</span>
              <span className="font-medium">Rp {currentShift.modal_awal.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/pos/checkout')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Lanjut ke Checkout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Open Shift</h1>

        <div className="mb-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-600 mb-1">Tanggal:</p>
            <p className="text-lg font-medium">{new Date().toLocaleDateString('id-ID', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>

          <label className="block text-sm font-medium mb-2">Modal Awal (Rp)</label>
          <input
            type="number"
            value={modalAwal}
            onChange={(e) => setModalAwal(parseInt(e.target.value) || 0)}
            className="w-full text-2xl p-4 border-2 rounded-lg"
            min="0"
            step="10000"
          />
          <p className="text-xs text-gray-500 mt-1">
            Modal awal akan dibagi untuk 2-3 kasir
          </p>
        </div>

        <button
          onClick={handleOpenShift}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Opening Shift...' : 'Open Shift'}
        </button>
      </div>
    </div>
  )
}
```

#### API Implementation
```typescript
// app/api/pos/shift/open/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role (only Manager/Owner)
    if (!['Owner', 'Manager_Toko', 'Manager_BO'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Only Manager/Owner can open shift' },
        { status: 403 }
      )
    }

    const { modal_awal } = await req.json()

    // Check if shift already open today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingShift = await prisma.shifts.findFirst({
      where: {
        branch_id: user.branchId,
        shift_date: {
          gte: today
        },
        status: 'open'
      }
    })

    if (existingShift) {
      return NextResponse.json(
        { error: 'Shift sudah dibuka untuk hari ini' },
        { status: 400 }
      )
    }

    // Create new shift
    const shift = await prisma.shifts.create({
      data: {
        branch_id: user.branchId,
        shift_date: new Date(),
        opened_by: user.userId,
        opened_at: new Date(),
        modal_awal: modal_awal || 200000,
        status: 'open'
      }
    })

    return NextResponse.json({ shift }, { status: 201 })
  } catch (error) {
    console.error('Open shift error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.6.1 Shift Management
- **BACKOFFICE_PRD_6_OPERATIONS.md** Section 3.2.1 Shift Opening

---

### **Story 6.2: Multi-Kasir per Shift (2-3 Kasir Concurrent)**

**As a** Kasir  
**I want to** login dan checkout bersamaan dengan kasir lain di shift yang sama  
**So that** pelayanan customer lebih cepat

**Story Points**: 8

#### Acceptance Criteria
```
✅ Multi-kasir concurrent checkout:
   - 2-3 kasir bisa login bersamaan di 1 shift
   - Each kasir punya session sendiri
   - Each kasir bisa checkout independent
   - Modal shared Rp 200k (tidak enforce split)

✅ Kasir identification:
   - Transaction record: kasir_id (who processed)
   - Settlement will breakdown by kasir_id

✅ Session isolation:
   - Kasir A cart !== Kasir B cart
   - Each browser session independent
   - No conflict between kasir

✅ Shift validation:
   - Cannot checkout jika shift belum open
   - Redirect to "Shift belum dibuka" jika no active shift

✅ Kasir tracking:
   - System track which kasir processed which transaction
   - Display kasir name di receipt
```

#### Technical Tasks
- [ ] Implement session isolation (per browser/device)
- [ ] Track kasir_id in transaction
- [ ] Validate active shift before checkout
- [ ] Test concurrent checkout (2-3 kasir simultaneously)

#### Session Management
```typescript
// lib/pos/session.ts
// Browser-based session (localStorage + cookie)
// Each device/browser = unique kasir session

export function getCurrentKasirSession(): {
  userId: number
  name: string
  branchId: number
  shiftId: number
} | null {
  if (typeof window === 'undefined') return null

  const sessionData = localStorage.getItem('pos_kasir_session')
  if (!sessionData) return null

  return JSON.parse(sessionData)
}

export function setKasirSession(session: any) {
  localStorage.setItem('pos_kasir_session', JSON.stringify(session))
}

export function clearKasirSession() {
  localStorage.removeItem('pos_kasir_session')
}
```

#### Shift Validation Middleware
```typescript
// lib/pos/validate-shift.ts
export async function validateActiveShift(branchId: number): Promise<{
  valid: boolean
  shift?: any
  error?: string
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const shift = await prisma.shifts.findFirst({
    where: {
      branch_id: branchId,
      shift_date: {
        gte: today
      },
      status: 'open'
    }
  })

  if (!shift) {
    return {
      valid: false,
      error: 'Shift belum dibuka. Hubungi manager untuk open shift.'
    }
  }

  return {
    valid: true,
    shift
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.6 Multi-Kasir (v1.1)
- User requirement: 1 shift = 2-3 kasir concurrent

---

### **Story 6.3: Input Daily Expenses saat Settlement**

**As a** Kasir  
**I want to** input pengeluaran harian saat settlement  
**So that** semua pengeluaran tercatat

**Story Points**: 3

#### Acceptance Criteria
```
✅ Daily expenses input:
   - During settlement flow
   - Form fields:
     * Category (dropdown):
       - Transport
       - Konsumsi
       - Perlengkapan
       - Lain-lain
     * Amount (Rp)
     * Notes (optional)
   - Multiple entries allowed (add row)
   - Show total expenses

✅ Save to daily_expenses table:
   - shift_id
   - kasir_id (who input)
   - category
   - amount
   - notes
   - created_at

✅ Integration dengan settlement:
   - Total expenses dikurangi dari expected cash
   - Expected Cash = Modal + Sales Cash - Total Daily Expenses

✅ Display in settlement summary:
   - List daily expenses per category
   - Total amount
```

#### Technical Tasks
- [ ] Create DailyExpensesInput component
- [ ] Create API endpoint:
  - `POST /api/pos/daily-expenses`
- [ ] Integrate dengan settlement calculation
- [ ] Test daily expenses input & calculation

#### Component Example
```tsx
// components/pos/DailyExpensesInput.tsx
export default function DailyExpensesInput({
  shiftId,
  kasirId,
  onExpensesUpdated
}: {
  shiftId: number
  kasirId: number
  onExpensesUpdated: (total: number) => void
}) {
  const [expenses, setExpenses] = useState<{
    category: string
    amount: number
    notes: string
  }[]>([])

  const categories = ['Transport', 'Konsumsi', 'Perlengkapan', 'Lain-lain']

  const addExpense = () => {
    setExpenses([...expenses, { category: 'Transport', amount: 0, notes: '' }])
  }

  const updateExpense = (index: number, field: string, value: any) => {
    const updated = [...expenses]
    updated[index] = { ...updated[index], [field]: value }
    setExpenses(updated)
    
    // Update total
    const total = updated.reduce((sum, exp) => sum + (exp.amount || 0), 0)
    onExpensesUpdated(total)
  }

  const removeExpense = (index: number) => {
    const updated = expenses.filter((_, i) => i !== index)
    setExpenses(updated)
    
    const total = updated.reduce((sum, exp) => sum + (exp.amount || 0), 0)
    onExpensesUpdated(total)
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Pengeluaran Harian</h3>
        <button
          onClick={addExpense}
          className="text-blue-600 hover:underline text-sm"
        >
          + Tambah Pengeluaran
        </button>
      </div>

      <div className="space-y-2">
        {expenses.map((expense, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start">
            <select
              value={expense.category}
              onChange={(e) => updateExpense(idx, 'category', e.target.value)}
              className="col-span-3 border p-2 rounded text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <input
              type="number"
              value={expense.amount || ''}
              onChange={(e) => updateExpense(idx, 'amount', parseInt(e.target.value) || 0)}
              className="col-span-3 border p-2 rounded text-sm"
              placeholder="Rp 0"
              min="0"
            />

            <input
              type="text"
              value={expense.notes}
              onChange={(e) => updateExpense(idx, 'notes', e.target.value)}
              className="col-span-5 border p-2 rounded text-sm"
              placeholder="Catatan (optional)"
            />

            <button
              onClick={() => removeExpense(idx)}
              className="col-span-1 text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        ))}

        {expenses.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">
            Belum ada pengeluaran. Klik "Tambah Pengeluaran" jika ada.
          </p>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Pengeluaran:</span>
            <span className="text-lg font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.6.3 Daily Expenses
- **BACKOFFICE_PRD_5_FINANCE.md** Section 3.4 OpEx

---

### **Story 6.4: Settlement Breakdown per Kasir**

**As a** Manager Toko  
**I want to** settlement dengan breakdown per kasir  
**So that** saya tahu performa & variance masing-masing kasir

**Story Points**: 8

#### Acceptance Criteria
```
✅ Settlement page accessible di `/pos/settlement`
✅ Pre-conditions:
   - Only Manager/Owner can access
   - Must have active (open) shift
   - All kasir harus sudah input real cash mereka

✅ Settlement calculation per kasir:
   For each kasir:
   1. Get all transactions by kasir_id for this shift
   2. Calculate:
      - Sales Cash = SUM(transactions WHERE payment_method = 'cash')
      - Sales Non-cash = SUM(transactions WHERE payment_method != 'cash')
      - Daily Expenses (if any) = SUM(daily_expenses by kasir_id)
      - Expected Cash = (Modal / jumlah kasir) + Sales Cash - Daily Expenses
   3. Input Real Cash (manual input per kasir)
   4. Calculate Variance = Real Cash - Expected Cash

✅ Settlement summary (total shift):
   - Total Sales Cash (all kasir)
   - Total Sales Non-cash (all kasir)
   - Total Daily Expenses (all kasir)
   - Expected Total Cash
   - Real Total Cash
   - Total Variance

✅ Settlement breakdown table:
   | Kasir | Sales Cash | Sales Non-cash | Expenses | Expected Cash | Real Cash | Variance |
   |-------|------------|----------------|----------|---------------|-----------|----------|

✅ Input real cash per kasir:
   - Each kasir row: Input field "Real Cash"
   - Kasir input sendiri (atau manager input)
   - Auto-calculate variance

✅ Save settlement:
   - Create settlements record (shift summary)
   - Create settlement_kasir_breakdown records (per kasir detail)
   - Update shift status: 'open' → 'closed'

✅ Validation:
   - All kasir must input real cash
   - Real cash must be >= 0
   - Cannot settle shift twice
```

#### Technical Tasks
- [ ] Create `/app/pos/settlement/page.tsx`
- [ ] Create SettlementBreakdown component
- [ ] Implement settlement calculation per kasir
- [ ] Create API endpoint:
  - `POST /api/pos/settlement`
- [ ] Test settlement calculation accuracy
- [ ] Test variance calculation

#### Component Example
```tsx
// app/pos/settlement/page.tsx
'use client'
import { useState, useEffect } from 'react'

interface KasirSettlement {
  kasir_id: number
  kasir_name: string
  sales_cash: number
  sales_noncash: number
  daily_expenses: number
  expected_cash: number
  real_cash: number
  variance: number
}

export default function SettlementPage() {
  const [shift, setShift] = useState<any>(null)
  const [kasirBreakdown, setKasirBreakdown] = useState<KasirSettlement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettlementData()
  }, [])

  const fetchSettlementData = async () => {
    const res = await fetch('/api/pos/settlement/data')
    const data = await res.json()
    
    setShift(data.shift)
    setKasirBreakdown(data.kasirBreakdown)
    setLoading(false)
  }

  const handleRealCashInput = (kasirId: number, realCash: number) => {
    setKasirBreakdown(kasirBreakdown.map(k => {
      if (k.kasir_id === kasirId) {
        const variance = realCash - k.expected_cash
        return { ...k, real_cash: realCash, variance }
      }
      return k
    }))
  }

  const handleSettlement = async () => {
    // Validate all kasir input real cash
    const notInputted = kasirBreakdown.filter(k => k.real_cash === 0)
    if (notInputted.length > 0) {
      alert('Semua kasir harus input real cash dulu')
      return
    }

    if (!confirm('Yakin tutup shift & finalize settlement?')) return

    try {
      const res = await fetch('/api/pos/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: shift.shift_id,
          kasir_breakdown: kasirBreakdown
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }

      alert('Settlement berhasil! Shift ditutup.')
      window.location.href = '/pos'
    } catch (error) {
      alert(error.message)
    }
  }

  const totalSalesCash = kasirBreakdown.reduce((sum, k) => sum + k.sales_cash, 0)
  const totalSalesNoncash = kasirBreakdown.reduce((sum, k) => sum + k.sales_noncash, 0)
  const totalExpenses = kasirBreakdown.reduce((sum, k) => sum + k.daily_expenses, 0)
  const totalExpectedCash = kasirBreakdown.reduce((sum, k) => sum + k.expected_cash, 0)
  const totalRealCash = kasirBreakdown.reduce((sum, k) => sum + k.real_cash, 0)
  const totalVariance = kasirBreakdown.reduce((sum, k) => sum + k.variance, 0)

  if (loading) return <p>Loading...</p>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settlement Shift</h1>

        {/* Shift Info */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tanggal:</p>
              <p className="font-medium">{new Date(shift.shift_date).toLocaleDateString('id-ID')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Opened by:</p>
              <p className="font-medium">{shift.opened_by_user.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Modal Awal:</p>
              <p className="font-medium">{formatCurrency(shift.modal_awal)}</p>
            </div>
          </div>
        </div>

        {/* Kasir Breakdown Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto mb-6">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Kasir</th>
                <th className="p-3 text-right">Sales Cash</th>
                <th className="p-3 text-right">Sales Non-Cash</th>
                <th className="p-3 text-right">Expenses</th>
                <th className="p-3 text-right">Expected Cash</th>
                <th className="p-3 text-right">Real Cash</th>
                <th className="p-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {kasirBreakdown.map(kasir => (
                <tr key={kasir.kasir_id} className="border-t">
                  <td className="p-3 font-medium">{kasir.kasir_name}</td>
                  <td className="p-3 text-right">{formatCurrency(kasir.sales_cash)}</td>
                  <td className="p-3 text-right">{formatCurrency(kasir.sales_noncash)}</td>
                  <td className="p-3 text-right text-red-600">{formatCurrency(kasir.daily_expenses)}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(kasir.expected_cash)}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={kasir.real_cash || ''}
                      onChange={(e) => handleRealCashInput(kasir.kasir_id, parseInt(e.target.value) || 0)}
                      className="w-full text-right border p-2 rounded"
                      placeholder="0"
                      min="0"
                    />
                  </td>
                  <td className={`p-3 text-right font-bold ${
                    kasir.variance > 0 ? 'text-green-600' : kasir.variance < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {kasir.variance > 0 && '+'}{formatCurrency(kasir.variance)}
                  </td>
                </tr>
              ))}

              {/* Total Row */}
              <tr className="border-t-2 bg-gray-50 font-bold">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right">{formatCurrency(totalSalesCash)}</td>
                <td className="p-3 text-right">{formatCurrency(totalSalesNoncash)}</td>
                <td className="p-3 text-right text-red-600">{formatCurrency(totalExpenses)}</td>
                <td className="p-3 text-right">{formatCurrency(totalExpectedCash)}</td>
                <td className="p-3 text-right">{formatCurrency(totalRealCash)}</td>
                <td className={`p-3 text-right ${
                  totalVariance > 0 ? 'text-green-600' : totalVariance < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {totalVariance > 0 && '+'}{formatCurrency(totalVariance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalSalesCash + totalSalesNoncash)}
            </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className={`p-4 rounded-lg ${
            totalVariance >= 0 ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <p className="text-sm text-gray-600 mb-1">Total Variance</p>
            <p className={`text-2xl font-bold ${
              totalVariance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {totalVariance > 0 && '+'}{formatCurrency(totalVariance)}
            </p>
          </div>
        </div>

        {/* Settlement Button */}
        <button
          onClick={handleSettlement}
          className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700"
        >
          Finalize Settlement & Close Shift
        </button>
      </div>
    </div>
  )
}
```

#### Settlement Calculation Logic
```typescript
// lib/pos/settlement-calculator.ts
export async function calculateSettlement(shiftId: number) {
  // Get shift
  const shift = await prisma.shifts.findUnique({
    where: { shift_id: shiftId },
    include: {
      opened_by_user: true
    }
  })

  if (!shift) throw new Error('Shift not found')

  // Get all transactions for this shift
  const transactions = await prisma.transactions.findMany({
    where: {
      shift_id: shiftId,
      status: 'completed'
    },
    include: {
      kasir: true
    }
  })

  // Get all daily expenses for this shift
  const expenses = await prisma.daily_expenses.findMany({
    where: { shift_id: shiftId }
  })

  // Get unique kasir who worked in this shift
  const kasirIds = [...new Set(transactions.map(t => t.kasir_id))]
  
  const kasirBreakdown = kasirIds.map(kasirId => {
    const kasirTrx = transactions.filter(t => t.kasir_id === kasirId)
    const kasirExpenses = expenses.filter(e => e.kasir_id === kasirId)

    const salesCash = kasirTrx
      .filter(t => t.payment_method === 'cash')
      .reduce((sum, t) => sum + t.net_amount, 0)

    const salesNoncash = kasirTrx
      .filter(t => t.payment_method !== 'cash')
      .reduce((sum, t) => sum + t.net_amount, 0)

    const dailyExpenses = kasirExpenses.reduce((sum, e) => sum + e.amount, 0)

    // Modal split equally among kasir
    const modalPerKasir = shift.modal_awal / kasirIds.length

    const expectedCash = modalPerKasir + salesCash - dailyExpenses

    return {
      kasir_id: kasirId,
      kasir_name: kasirTrx[0].kasir.name,
      sales_cash: salesCash,
      sales_noncash: salesNoncash,
      daily_expenses: dailyExpenses,
      expected_cash: expectedCash,
      real_cash: 0, // To be input by kasir
      variance: 0 // Will calculate after real cash input
    }
  })

  return {
    shift,
    kasirBreakdown
  }
}
```

#### Save Settlement
```typescript
// app/api/pos/settlement/route.ts
export async function POST(req: NextRequest) {
  const { shift_id, kasir_breakdown } = await req.json()

  try {
    await prisma.$transaction(async (tx) => {
      // Calculate totals
      const totalSalesCash = kasir_breakdown.reduce((sum: number, k: any) => sum + k.sales_cash, 0)
      const totalSalesNoncash = kasir_breakdown.reduce((sum: number, k: any) => sum + k.sales_noncash, 0)
      const totalDailyExpenses = kasir_breakdown.reduce((sum: number, k: any) => sum + k.daily_expenses, 0)
      const totalExpectedCash = kasir_breakdown.reduce((sum: number, k: any) => sum + k.expected_cash, 0)
      const totalRealCash = kasir_breakdown.reduce((sum: number, k: any) => sum + k.real_cash, 0)
      const totalVariance = totalRealCash - totalExpectedCash

      // Get shift
      const shift = await tx.shifts.findUnique({
        where: { shift_id }
      })

      // Create settlement record
      const settlement = await tx.settlements.create({
        data: {
          shift_id,
          branch_id: shift!.branch_id,
          settlement_date: new Date(),
          modal_awal: shift!.modal_awal,
          total_sales_cash: totalSalesCash,
          total_sales_noncash: totalSalesNoncash,
          total_daily_expenses: totalDailyExpenses,
          expected_cash: totalExpectedCash,
          real_cash: totalRealCash,
          variance: totalVariance,
          settled_by: 1 // Current user ID (get from session)
        }
      })

      // Create settlement kasir breakdown
      for (const kasir of kasir_breakdown) {
        await tx.settlement_kasir_breakdown.create({
          data: {
            settlement_id: settlement.settlement_id,
            kasir_id: kasir.kasir_id,
            sales_cash: kasir.sales_cash,
            sales_noncash: kasir.sales_noncash,
            daily_expenses: kasir.daily_expenses,
            expected_cash: kasir.expected_cash,
            real_cash: kasir.real_cash,
            variance: kasir.variance
          }
        })
      }

      // Update shift status to closed
      await tx.shifts.update({
        where: { shift_id },
        data: {
          status: 'closed',
          closed_by: 1, // Current user ID
          closed_at: new Date()
        }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settlement error:', error)
    return NextResponse.json(
      { error: 'Settlement failed' },
      { status: 500 }
    )
  }
}
```

#### PRD Reference
- **POS_PRD.md** Section 5.6 Settlement (v1.1 Multi-Kasir)
- **BACKOFFICE_PRD_6_OPERATIONS.md** Section 3.2 Settlement Monitoring

---

### **Story 6.5: Close Shift (Manual)**

**As a** Manager Toko  
**I want to** close shift setelah settlement  
**So that** shift hari ini selesai & besok bisa open shift baru

**Story Points**: 3

#### Acceptance Criteria
```
✅ Close shift action:
   - Automatically closed setelah settlement finalized
   - Update shift record:
     * status: 'open' → 'closed'
     * closed_by: [user_id]
     * closed_at: [timestamp]

✅ Post-close state:
   - Cannot checkout for this shift anymore
   - Can view settlement report
   - Can open new shift tomorrow

✅ Validation:
   - Cannot close shift tanpa settlement
   - All kasir must settled
```

#### Technical Tasks
- [ ] Implement close shift logic (sudah include di Story 6.4)
- [ ] Validate settlement before close
- [ ] Block checkout after shift closed
- [ ] Test close shift

#### PRD Reference
- **POS_PRD.md** Section 5.6.1 Shift Close

---

## 📊 SPRINT 6 SUMMARY

### Story Points Breakdown
| Story | Points | Assignee Suggestion |
|-------|--------|---------------------|
| 6.1 Open Shift | 5 | Dev 1 |
| 6.2 Multi-Kasir Concurrent | 8 | Dev 2 |
| 6.3 Daily Expenses Input | 3 | Dev 1 |
| 6.4 Settlement Breakdown | 8 | Dev 1 + Dev 2 |
| 6.5 Close Shift | 3 | Dev 2 |
| **TOTAL** | **27** | |

### Definition of Done
```
✅ Shift open/close working
✅ Multi-kasir concurrent checkout working
✅ Daily expenses input working
✅ Settlement breakdown per kasir accurate
✅ Variance calculation correct
✅ Close shift after settlement working
✅ Code reviewed & merged
✅ Manual testing completed (2-3 kasir concurrent)
✅ No critical bugs
```

### Sprint Deliverables
1. ✅ Open shift functionality
2. ✅ Multi-kasir (2-3 kasir) concurrent checkout
3. ✅ Daily expenses tracking
4. ✅ Settlement dengan breakdown per kasir
5. ✅ Variance calculation & reporting
6. ✅ Close shift functionality

---

## 🧪 TESTING CHECKLIST

### Functional Testing
- [ ] Open shift → Kasir bisa checkout
- [ ] 2 kasir login & checkout simultaneously → No conflict
- [ ] 3 kasir login & checkout simultaneously → No conflict
- [ ] Input daily expenses Rp 50k → Expected cash reduced
- [ ] Kasir A real cash = expected → Variance = 0
- [ ] Kasir B real cash > expected → Variance positive (+)
- [ ] Kasir C real cash < expected → Variance negative (-)
- [ ] Settlement → Shift closed → Cannot checkout anymore

### Edge Cases
- [ ] Open shift 2x di hari yang sama → Error
- [ ] Settlement dengan 0 transactions → Handle gracefully
- [ ] Settlement tanpa input real cash → Validation error
- [ ] Close shift before settlement → Error

---

## 🚨 RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Variance calculation error | HIGH | Extensive unit tests, Manual verification |
| Multi-kasir session conflict | MEDIUM | Proper session isolation, Test concurrent access |
| Daily expenses not recorded | MEDIUM | Validation, Required field |
| Modal split tidak akurat | LOW | Clear documentation, Simple division |

---

## 📝 NOTES FOR NEXT SPRINT

**Sprint 7 Dependencies:**
- Settlement data dari Sprint 6 → Sprint 7 akan tampil di backoffice monitoring
- Daily expenses dari Sprint 6 → Sprint 7 aggregate untuk laporan
- Shift closed dari Sprint 6 → Sprint 7 validation untuk SO

---

**Last Updated**: 18 April 2026  
**Sprint Status**: 🔴 Not Started  
**Previous Sprint**: MVP_SPRINT_5_PAYMENT_RECEIPT.md  
**Next Sprint**: MVP_SPRINT_7_SO_BARANG_RUSAK.md
