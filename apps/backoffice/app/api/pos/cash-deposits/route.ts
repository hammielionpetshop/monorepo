import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requirePermission } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { parseJsonBody } from '@/lib/grooming-master-http'
import {
  listCashDepositDefaults, listDepositDestinations, listDeposits, listUndepositedShifts, summarizeUndeposited,
} from '@/lib/services/deposit-queries'
import { getDepositSettings, reportCashDeposit } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse, reportSchema } from '../../bo/deposits/_http'

export const dynamic = 'force-dynamic'

/** POS › Setor Tunai: shift tunai cabang ini yang belum disetor + setoran cabang ini. */
export async function GET() {
  const gate = await requirePermission('deposit.report')
  if (gate instanceof NextResponse) return gate
  try {
    const branchId = getPosBranchId(gate, await cookies())
    const settings = await getDepositSettings()
    const [shifts, deposits, destinations, defaults] = await Promise.all([
      listUndepositedShifts({ branchId, settings }),
      listDeposits({ statuses: ['PENDING', 'VERIFIED', 'CANCELLED', 'CORRECTED'], branchId, limit: 30 }),
      listDepositDestinations(),
      listCashDepositDefaults(),
    ])
    const banks = destinations.filter((d) => d.kind === 'BANK')
    const defaultId = defaults.find((d) => d.branchId === branchId)?.moneyPlaceId ?? null
    return NextResponse.json({
      summary: summarizeUndeposited(shifts, settings)[0] ?? null,
      shifts: shifts.map((s) => ({ shiftId: s.shiftId, shiftNumber: s.shiftNumber, openedOn: s.openedOn, closedOn: s.closedOn, cash: s.cash, ageDays: s.ageDays, legacy: s.legacy })),
      deposits: deposits.map((d) => ({
        id: d.id, depositNumber: d.depositNumber, status: d.status, depositDate: d.depositDate, destinationName: d.destinationName,
        reportedAmount: d.reportedAmount, receivedAmount: d.receivedAmount, reportChannel: d.reportChannel,
        shiftCount: d.shifts.length, cancelReason: d.cancelReason, reportedByName: d.reportedByName,
      })),
      banks: banks.map((b) => ({ id: b.id, name: b.name, bankName: b.bankName, accountNumber: b.accountNumber })),
      defaultBankId: banks.some((b) => b.id === defaultId) ? defaultId : null,
      settings: { warnDays: settings.warnDays, warnAmount: settings.warnAmount },
    })
  } catch (error) {
    return depositErrorResponse(error, 'GET /api/pos/cash-deposits')
  }
}

/** Laporkan Setoran (setor bank) → Menunggu verifikasi Finance. */
export async function POST(req: NextRequest) {
  const gate = await requirePermission('deposit.report')
  if (gate instanceof NextResponse) return gate
  try {
    const data = await parseJsonBody(req, reportSchema)
    if (data instanceof NextResponse) return data
    const branchId = getPosBranchId(gate, await cookies())
    const created = await reportCashDeposit({ ...data, branchId }, actorOf(gate))
    return NextResponse.json({ id: created.id, depositNumber: created.depositNumber }, { status: 201 })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/pos/cash-deposits')
  }
}
