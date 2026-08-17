import { redirect } from 'next/navigation'
import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import {
  db,
  branches,
  users,
  shifts,
  shiftExpenses,
  expenseCategories,
  eq,
  asc,
} from '@/lib/db'
import ExpenseClient from './_components/expense-client'
import type { Option } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function ShiftExpensesPage() {
  const payload = await getAuth()

  if (!payload) {
    redirect('/login')
  }
  if (!hasPermission(payload, 'shift_expense.read')) {
    redirect('/dashboard')
  }

  const seesAllBranches = payload.branchScope === 'ALL'
  const scope = scopeFilter(payload, shifts.branchId)

  // Dropdown kasir diisi dari kasir yang benar-benar punya pengeluaran, bukan seluruh user:
  // daftar staf lengkap membuat filter ini penuh nama yang tidak pernah menghasilkan baris.
  const [branchRows, cashierRows, categoryRows] = await Promise.all([
    seesAllBranches
      ? db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(eq(branches.isActive, true))
          .orderBy(asc(branches.name))
      : Promise.resolve([] as Option[]),
    db
      .selectDistinct({ id: users.id, name: users.name })
      .from(shiftExpenses)
      .innerJoin(shifts, eq(shiftExpenses.shiftId, shifts.id))
      .innerJoin(users, eq(shiftExpenses.cashierId, users.id))
      .where(scope)
      .orderBy(asc(users.name)),
    db
      .select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .orderBy(asc(expenseCategories.name)),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Pengeluaran Shift</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seluruh pengeluaran yang dicatat kasir dari POS. Hanya pengeluaran di shift yang masih
          berjalan yang bisa diubah atau dihapus — setelah shift ditutup, angkanya sudah ikut
          direkonsiliasi ke kas.
        </p>
      </div>
      <ExpenseClient
        branches={branchRows}
        cashiers={cashierRows}
        categories={categoryRows}
        showBranchFilter={seesAllBranches}
      />
    </div>
  )
}
