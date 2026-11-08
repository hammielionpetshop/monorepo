'use client'

import Link from 'next/link'
import { formatRupiah } from '@petshop/shared'
import { NewBadge } from '@/components/ui/new-badge'

// F2-2: status tunai (setoran) & non-tunai per metode di Detail Shift. Verifikasinya di menu Setoran.

export interface ShiftDepositStatusView {
  flow: 'NEW' | 'LEGACY' | 'NONE'
  cash: {
    state: 'NOT_DEPOSITED' | 'PENDING' | 'VERIFIED' | 'LEGACY_VERIFIED' | 'NOT_APPLICABLE'
    amount: number
    depositId: number | null
    depositNumber: string | null
    receivedAmount: number | null
  }
  noncash: {
    key: string
    paymentMethodName: string
    expected: number
    status: 'PENDING' | 'AWAITING_FUNDS' | 'VERIFIED'
    received: number | null
    variance: number | null
    cause: string | null
    changedAfterVerify: boolean
    verifiedExpected: number | null
    linkedPlaceName: string | null
  }[]
}

const CAUSE_LABEL: Record<string, string> = {
  BANK_FEE: 'potongan bank',
  CASHIER_INPUT: 'salah input kasir',
  OTHER: 'lainnya',
  AWAITING_FUNDS: 'dana belum cair',
}

function Pill({ tone, children }: { tone: 'amber' | 'blue' | 'green' | 'muted' | 'red'; children: React.ReactNode }) {
  const cls = {
    amber: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    green: 'bg-green-500/10 text-green-700 border-green-500/20',
    red: 'bg-red-500/10 text-red-700 border-red-500/20',
    muted: 'bg-muted text-muted-foreground border-border',
  }[tone]
  return <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${cls}`}>{children}</span>
}

export function DepositStatusPanel({ status }: { status: ShiftDepositStatusView }) {
  if (status.flow === 'NONE') return null
  const { cash } = status
  return (
    <div className="px-6 py-4 border-b border-border">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Setoran <NewBadge feature="/deposits" />
        </h3>
        <Link href="/deposits" className="text-xs text-primary hover:underline">Buka menu Setoran →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Tunai {status.flow === 'LEGACY' && <span>(shift lama)</span>}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{formatRupiah(cash.amount)}</span>
            {cash.state === 'NOT_DEPOSITED' && <Pill tone="amber">Belum disetor</Pill>}
            {cash.state === 'PENDING' && <Pill tone="blue">Menunggu verifikasi · {cash.depositNumber}</Pill>}
            {cash.state === 'VERIFIED' && (
              <Pill tone="green">
                Terverifikasi · {cash.depositNumber}
                {cash.receivedAmount != null && ` (setoran diterima ${formatRupiah(cash.receivedAmount)})`}
              </Pill>
            )}
            {cash.state === 'NOT_APPLICABLE' && <Pill tone="muted">Tidak diverifikasi</Pill>}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Non-tunai per metode</p>
          {status.flow === 'LEGACY' ? (
            <p className="text-xs text-muted-foreground">Shift sebelum tanggal mulai Setoran — non-tunai tidak diantrekan.</p>
          ) : status.noncash.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada pembayaran non-tunai.</p>
          ) : (
            <ul className="space-y-1">
              {status.noncash.map((n) => (
                <li key={n.key} className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground">{n.paymentMethodName}</span>
                  <span className="text-muted-foreground">{formatRupiah(n.expected)}</span>
                  {n.status === 'PENDING' && <Pill tone="amber">Menunggu</Pill>}
                  {n.status === 'AWAITING_FUNDS' && <Pill tone="blue">Dana belum cair</Pill>}
                  {n.status === 'VERIFIED' && (
                    <Pill tone={n.variance ? 'red' : 'green'}>
                      Terverifikasi{n.variance ? ` · selisih ${formatRupiah(n.variance)}${n.cause ? ` (${CAUSE_LABEL[n.cause] ?? n.cause})` : ''}` : ''}
                    </Pill>
                  )}
                  {n.changedAfterVerify && (
                    <Pill tone="red">Angka sistem berubah sesudah diverifikasi (dulu {formatRupiah(n.verifiedExpected ?? 0)})</Pill>
                  )}
                  {!n.linkedPlaceName && n.status !== 'VERIFIED' && <Pill tone="red">Belum ditautkan ke rekening</Pill>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
