'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronRight, Download, Settings2 } from 'lucide-react'
import type { VarianceCategory } from '@/lib/cashier-variance'
import type {
  CashierVarianceReport,
  UnverifiedShiftView,
  VarianceShiftView,
} from '@/lib/services/cashier-variance-service'
import CashierVarianceSettingsDialog from './cashier-variance-settings-dialog'

interface BranchOption { id: number; name: string }

interface Props {
  report: CashierVarianceReport | null
  error: string | null
  month: string
  branchId: string
  branches: BranchOption[]
  isGlobal: boolean
  canEditSettings: boolean
}

const CATEGORY_LABEL: Record<VarianceCategory, string> = {
  MINUS: 'Minus',
  PLUS: 'Plus',
  TOLERATED: 'Dalam toleransi',
  MATCH: 'Cocok',
  ANOMALY: 'Tak wajar — cek',
}

const CATEGORY_STYLE: Record<VarianceCategory, string> = {
  MINUS: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PLUS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  TOLERATED: 'bg-muted text-muted-foreground',
  MATCH: 'bg-muted text-muted-foreground',
  ANOMALY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
}

function rupiah(value: number, withSign = false): string {
  const abs = new Intl.NumberFormat('id-ID').format(Math.abs(value))
  if (value < 0) return `−Rp ${abs}`
  return withSign && value > 0 ? `+Rp ${abs}` : `Rp ${abs}`
}

function amountTone(value: number): string {
  return value < 0 ? 'text-red-600' : value > 0 ? 'text-green-600' : 'text-muted-foreground'
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv(report: CashierVarianceReport) {
  const header = ['Shift', 'Cabang', 'Tanggal', 'Kas sistem', 'Diterima finance', 'Selisih resmi', 'Status', 'Kasir', 'Kas tunai', 'Porsi %', 'Bagian kasir', 'Catatan finance']
  const lines = [header]
  for (const s of report.shifts) {
    const base = [`#${s.shiftNumber} (${s.shiftId})`, s.branchName, s.date, s.expectedCash ?? '', s.receivedCash, s.variance ?? '', CATEGORY_LABEL[s.category]]
    const rows = s.allocations.length ? s.allocations : s.shares
    if (rows.length === 0) lines.push([...base, '', '', '', '', s.depositNotes ?? ''].map(String))
    for (const a of rows) {
      lines.push([...base, a.cashierName, a.cash, a.sharePct, s.allocations.length ? a.amount : 0, s.depositNotes ?? ''].map(String))
    }
  }
  // BOM supaya Excel membaca UTF-8 dengan benar; titik koma = pemisah bawaan Excel berbahasa Indonesia.
  const csv = '﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `minus-kasir-${report.month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function UnverifiedBox({ shifts }: { shifts: UnverifiedShiftView[] }) {
  const [open, setOpen] = useState(true)
  const byBranch = useMemo(() => {
    const map = new Map<string, UnverifiedShiftView[]>()
    for (const s of shifts) map.set(s.branchName, [...(map.get(s.branchName) ?? []), s])
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [shifts])

  if (shifts.length === 0) {
    return (
      <div className="rounded-lg border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
        Semua shift POS yang sudah tutup pada periode ini sudah diverifikasi finance.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-900/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-amber-800 dark:text-amber-300"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          {shifts.length} shift belum diverifikasi finance — belum masuk hitungan minus/plus
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-amber-500/30 px-4 py-3 text-sm">
          {byBranch.map(([branch, list]) => (
            <div key={branch} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <span className="w-44 shrink-0 font-medium text-foreground">{branch} ({list.length})</span>
              <span className="flex flex-wrap gap-1">
                {list.map((s) => (
                  <span
                    key={s.shiftId}
                    title={`Shift #${s.shiftNumber}${s.status === 'FORCE_CLOSED' ? ' — tutup paksa' : ''}`}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
                  >
                    {dayLabel(s.date)} · #{s.shiftNumber}
                    {s.status === 'FORCE_CLOSED' && <span className="ml-1 text-amber-700 dark:text-amber-400">paksa</span>}
                  </span>
                ))}
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Verifikasi setoran dilakukan di{' '}
            <Link href="/shift-history" className="text-primary hover:underline">Riwayat Shift</Link>{' '}
            → buka shift → Verifikasi Setoran.
          </p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function AllocationLines({ shift }: { shift: VarianceShiftView }) {
  if (shift.category === 'ANOMALY') return <span className="text-xs text-amber-700 dark:text-amber-400">Tidak dibagi — cek verifikasi</span>
  if (shift.category === 'TOLERATED' || shift.category === 'MATCH') return <span className="text-xs text-muted-foreground">Tidak dibebankan</span>
  if (shift.allocations.length === 0) return <span className="text-xs text-amber-700 dark:text-amber-400">Tak terbagi — tanpa kas tunai</span>
  return (
    <div className="space-y-0.5">
      {shift.allocations.map((a) => (
        <div key={a.cashierId} className="flex justify-between gap-3 whitespace-nowrap text-xs">
          <span className="text-foreground">{a.cashierName} <span className="text-muted-foreground">{a.sharePct}%</span></span>
          <span className={`tabular-nums ${amountTone(a.amount)}`}>{rupiah(a.amount, true)}</span>
        </div>
      ))}
    </div>
  )
}

function CashierRecapTab({ report }: { report: CashierVarianceReport }) {
  const [openId, setOpenId] = useState<number | null>(null)
  if (report.cashiers.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada shift terverifikasi pada periode ini.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-xs text-muted-foreground">
        <tr>
          <th className="px-4 py-2 text-left font-medium">Kasir</th>
          <th className="px-4 py-2 text-right font-medium">Shift diikuti</th>
          <th className="px-4 py-2 text-right font-medium">Minus</th>
          <th className="px-4 py-2 text-right font-medium">Plus</th>
          <th className="px-4 py-2 text-left font-medium">Shift minus / plus</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {report.cashiers.map((c) => {
          const open = openId === c.cashierId
          const rows = open
            ? report.shifts.flatMap((s) => {
                const a = s.allocations.find((x) => x.cashierId === c.cashierId)
                return a && a.amount !== 0 ? [{ shift: s, a }] : []
              })
            : []
          return (
            <React.Fragment key={c.cashierId}>
              <tr className="cursor-pointer hover:bg-muted/20" onClick={() => setOpenId(open ? null : c.cashierId)}>
                <td className="px-4 py-2 font-medium text-foreground">
                  <span className="inline-flex items-center gap-1">
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {c.cashierName}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{c.shiftCount}</td>
                <td className={`px-4 py-2 text-right font-semibold tabular-nums ${amountTone(c.minus)}`}>{c.minus ? rupiah(c.minus) : '-'}</td>
                <td className={`px-4 py-2 text-right font-semibold tabular-nums ${amountTone(c.plus)}`}>{c.plus ? rupiah(c.plus, true) : '-'}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.minusShiftCount} minus · {c.plusShiftCount} plus</td>
              </tr>
              {open && (
                <tr>
                  <td colSpan={5} className="bg-muted/10 px-4 py-2">
                    {rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Tidak ada minus/plus yang dibebankan ke {c.cashierName}.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 text-left font-medium">Shift</th>
                            <th className="py-1 text-left font-medium">Cabang</th>
                            <th className="py-1 text-left font-medium">Tanggal</th>
                            <th className="py-1 text-right font-medium">Selisih shift</th>
                            <th className="py-1 text-right font-medium">Porsi</th>
                            <th className="py-1 text-right font-medium">Bagian {c.cashierName}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ shift, a }) => (
                            <tr key={shift.shiftId}>
                              <td className="py-1">#{shift.shiftNumber}</td>
                              <td className="py-1">{shift.branchName}</td>
                              <td className="py-1">{dayLabel(shift.date)}</td>
                              <td className={`py-1 text-right tabular-nums ${amountTone(shift.variance ?? 0)}`}>{rupiah(shift.variance ?? 0, true)}</td>
                              <td className="py-1 text-right tabular-nums">{a.sharePct}%</td>
                              <td className={`py-1 text-right font-medium tabular-nums ${amountTone(a.amount)}`}>{rupiah(a.amount, true)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function ShiftTab({ report }: { report: CashierVarianceReport }) {
  const [filter, setFilter] = useState<VarianceCategory | ''>('')
  const shifts = filter ? report.shifts.filter((s) => s.category === filter) : report.shifts
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as VarianceCategory | '')}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="">Semua</option>
          {(Object.keys(CATEGORY_LABEL) as VarianceCategory[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Shift</th>
              <th className="px-4 py-2 text-left font-medium">Cabang</th>
              <th className="px-4 py-2 text-left font-medium">Tgl</th>
              <th className="px-4 py-2 text-right font-medium">Kas sistem</th>
              <th className="px-4 py-2 text-right font-medium">Diterima finance</th>
              <th className="px-4 py-2 text-right font-medium">Selisih resmi</th>
              <th className="px-4 py-2 text-left font-medium">Dibagi ke</th>
              <th className="px-4 py-2 text-left font-medium">Catatan finance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shifts.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Tidak ada shift.</td></tr>
            )}
            {shifts.map((s) => (
              <tr key={s.shiftId} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 font-medium">
                  #{s.shiftNumber}
                  {s.status === 'FORCE_CLOSED' && <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">paksa</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{s.branchName}</td>
                <td className="whitespace-nowrap px-4 py-2">{dayLabel(s.date)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{s.expectedCash != null ? rupiah(s.expectedCash) : '-'}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{rupiah(s.receivedCash)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <div className={`font-semibold tabular-nums ${amountTone(s.variance ?? 0)}`}>{s.variance != null ? rupiah(s.variance, true) : '-'}</div>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLE[s.category]}`}>
                    {CATEGORY_LABEL[s.category]}
                  </span>
                </td>
                <td className="min-w-[14rem] px-4 py-2"><AllocationLines shift={s} /></td>
                <td className="max-w-[12rem] px-4 py-2 text-xs text-muted-foreground">
                  {s.depositNotes ?? '-'}
                  {s.verifiedByName && <span className="block text-[10px]">oleh {s.verifiedByName}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CashierVarianceClient({ report, error, month, branchId, branches, isGlobal, canEditSettings }: Props) {
  const router = useRouter()
  const [monthInput, setMonthInput] = useState(month)
  const [branchInput, setBranchInput] = useState(branchId)
  const [tab, setTab] = useState<'cashier' | 'shift'>('cashier')
  const [settingsOpen, setSettingsOpen] = useState(false)

  function apply() {
    const sp = new URLSearchParams()
    if (monthInput) sp.set('month', monthInput)
    if (branchInput) sp.set('branchId', branchInput)
    router.push(`/cashier-variance?${sp}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Bulan</label>
          <input
            type="month"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {isGlobal && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cabang</label>
            <select
              value={branchInput}
              onChange={(e) => setBranchInput(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Semua Cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={apply}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Terapkan
        </button>
        <div className="flex-1" />
        {report && (
          <button
            type="button"
            onClick={() => canEditSettings && setSettingsOpen(true)}
            disabled={!canEditSettings}
            title={canEditSettings ? 'Ubah batas toleransi' : 'Hanya Owner/GM yang bisa mengubah'}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
          >
            <Settings2 className="h-4 w-4" />
            Toleransi: {rupiah(report.settings.tolerance)}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {report && (
        <>
          <UnverifiedBox shifts={report.unverified} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="Total Minus" value={rupiah(report.totals.minus)} tone={amountTone(report.totals.minus)} />
            <SummaryCard label="Total Plus" value={rupiah(report.totals.plus, true)} tone={amountTone(report.totals.plus)} />
            <SummaryCard label="Shift Minus" value={`${report.totals.minusShiftCount} shift`} />
            <SummaryCard label="Shift Plus" value={`${report.totals.plusShiftCount} shift`} />
            <SummaryCard label="Dalam Toleransi / Cocok" value={`${report.totals.toleratedShiftCount + report.totals.matchShiftCount} shift`} />
            <SummaryCard
              label="Tak Wajar (tidak dihitung)"
              value={`${report.totals.anomalyShiftCount} shift`}
              tone={report.totals.anomalyShiftCount ? 'text-amber-600' : undefined}
            />
          </div>

          {report.totals.unallocated !== 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {rupiah(report.totals.unallocated, true)} selisih tidak bisa dibagi karena shift-nya tanpa kas tunai tercatat.
            </p>
          )}

          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-1 border-b border-border px-2">
              {([['cashier', 'Rekap per Kasir'], ['shift', 'Per Shift']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`border-b-2 px-3 py-2.5 text-sm font-medium ${tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => exportCsv(report)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Download className="h-4 w-4" /> Ekspor (Excel)
              </button>
            </div>
            {tab === 'cashier' ? <CashierRecapTab report={report} /> : <ShiftTab report={report} />}
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {monthLabel(report.month)} · Minus dan plus tidak saling mengurangi — owner yang memutuskan penyelesaiannya.
              Selisih di bawah {rupiah(report.settings.tolerance)} tidak dibebankan; selisih ≥ {rupiah(report.settings.anomalyThreshold)} ditandai tak wajar dan tidak dibagi.
            </p>
          </div>
        </>
      )}

      {settingsOpen && report && (
        <CashierVarianceSettingsDialog
          initial={report.settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
