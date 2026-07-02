import Big from 'big.js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq } from '@/lib/db'
import { getDamagedGoodsReport, type DamagedReportData } from '@/lib/services/report-service'
import DamagedFilterClient from './_components/damaged-filter-client'

export const dynamic = 'force-dynamic'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const GLOBAL_ROLES = ['OWNER', 'GM']

const REASON_LABELS: Record<string, string> = {
  RUSAK: 'Rusak',
  EXPIRED: 'Kadaluarsa',
  HILANG: 'Hilang',
}

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default async function DamagedGoodsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; branchId?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    redirect('/login')
  }

  const isGlobal = GLOBAL_ROLES.includes(payload.role)
  const branchOptions = isGlobal
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : []

  const params = await searchParams
  const { startDate, endDate, branchId } = params

  let reportData: DamagedReportData | null = null
  let error: string | null = null

  if (startDate && endDate) {
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      error = 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.'
    } else if (startDate > endDate) {
      error = 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.'
    } else {
      const parsedBranch = branchId ? Number(branchId) : null
      const scopedBranchId = isGlobal
        ? Number.isInteger(parsedBranch) && parsedBranch! > 0
          ? parsedBranch
          : null
        : payload.branchId
      try {
        reportData = await getDamagedGoodsReport({ startDate, endDate, branchId: scopedBranchId })
      } catch {
        error = 'Gagal mengambil data barang rusak. Silakan coba lagi.'
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laporan Barang Rusak</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riwayat barang rusak/kadaluarsa/hilang beserta nilai kerugian (HPP)
        </p>
      </div>

      <DamagedFilterClient
        defaultStartDate={startDate}
        defaultEndDate={endDate}
        defaultBranchId={branchId}
        branches={isGlobal ? branchOptions : undefined}
      />

      {error && (
        <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {reportData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Total Kerugian
              </p>
              <p className="text-xl font-bold text-destructive mt-1">
                {formatRupiah(reportData.totalLossValue)}
              </p>
            </div>
            <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Jumlah Catatan
              </p>
              <p className="text-xl font-bold text-card-foreground mt-1">{reportData.totalEntries}</p>
            </div>
            {reportData.byReason.map((r) => (
              <div key={r.reason} className="bg-card rounded-lg border border-border p-5 shadow-xs">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {REASON_LABELS[r.reason] ?? r.reason} ({r.entryCount})
                </p>
                <p className="text-xl font-bold text-card-foreground mt-1">
                  {formatRupiah(r.lossValue)}
                </p>
              </div>
            ))}
          </div>

          {reportData.entries.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted-foreground shadow-xs">
              Tidak ada catatan barang rusak pada periode ini.
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                      <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Waktu</th>
                      <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
                      <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Alasan</th>
                      <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Item</th>
                      <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Dilaporkan</th>
                      <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Kerugian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/20 transition-colors align-top">
                        <td className="px-6 py-4 whitespace-nowrap text-card-foreground">
                          {formatDateTime(entry.reportedAt)}
                        </td>
                        <td className="px-6 py-4 text-card-foreground">{entry.branchName}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-xs font-semibold">
                            {REASON_LABELS[entry.reason] ?? entry.reason}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <ul className="space-y-1">
                            {entry.items.map((item, idx) => (
                              <li key={idx} className="text-card-foreground">
                                {item.productName}{' '}
                                <span className="text-muted-foreground">
                                  ({item.qty} {item.uomCode} · {formatRupiah(item.lossValue)})
                                </span>
                              </li>
                            ))}
                          </ul>
                          {entry.notes && (
                            <p className="mt-1.5 text-xs italic text-muted-foreground">“{entry.notes}”</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                          {entry.reportedByName}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-destructive whitespace-nowrap">
                          {formatRupiah(entry.totalLossValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40">
                      <td className="px-6 py-4 font-bold text-card-foreground" colSpan={5}>
                        TOTAL
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-destructive whitespace-nowrap">
                        {formatRupiah(reportData.totalLossValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
