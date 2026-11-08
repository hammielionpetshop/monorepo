'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Big from 'big.js'
import { simulateLegacySettlement, type BranchMoney } from '@/lib/services/legacy-settlement-rules'
import type { LegacyPreviewData } from '@/lib/services/legacy-settlement-service'

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const sum = (xs: number[]) => xs.reduce((t, x) => t.plus(x), new Big(0)).toNumber()

const RESULT_LABEL = {
  PAID: { label: 'Jadi lunas', cls: 'text-green-700 dark:text-green-400' },
  PARTIAL: { label: 'Sebagian', cls: 'text-amber-700 dark:text-amber-400' },
  OPEN: { label: 'Tetap terbuka', cls: 'text-red-700 dark:text-red-400' },
} as const

interface BranchRow {
  branchId: number
  name: string
  openCount: number
  openRemaining: number
  oldestDate: string | null
  verifiedCash: number
  verifiedShifts: number
  unverifiedCash: number
  unverifiedShifts: number
  noncash: number
  manualPaid: number
  manualCount: number
  available: number
  usable: number
  receivedFromChain: number
  paidOff: number
  remainingAfter: number
  freeAmount: number
}

export function LegacyPreviewClient({ data, quickDates }: {
  data: LegacyPreviewData
  quickDates: { date: string; label: string }[]
}) {
  const router = useRouter()
  const [fromInput, setFromInput] = useState(data.fromDate)
  const [includeNoncash, setIncludeNoncash] = useState(false)
  const [subtractManual, setSubtractManual] = useState(true)
  const [openBranch, setOpenBranch] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const branchName = useMemo(() => new Map(data.branches.map((b) => [b.id, b.name])), [data.branches])
  const nameOf = (id: number) => branchName.get(id) ?? `Cabang #${id}`

  const money = useMemo(() => {
    const ids = new Set<number>([
      ...data.payables.map((p) => p.debtorBranchId),
      ...data.shifts.map((s) => s.branchId),
      ...data.manualPayments.map((m) => m.debtorBranchId),
    ])
    return [...ids].map((branchId): BranchMoney & { verifiedShifts: number; unverifiedCash: number; unverifiedShifts: number; manualCount: number } => {
      const shifts = data.shifts.filter((s) => s.branchId === branchId)
      const verified = shifts.filter((s) => s.verified)
      const unverified = shifts.filter((s) => !s.verified)
      const manual = data.manualPayments.filter((m) => m.debtorBranchId === branchId)
      return {
        branchId,
        verifiedCash: sum(verified.map((s) => s.cash)),
        verifiedShifts: verified.length,
        unverifiedCash: sum(unverified.map((s) => s.cash)),
        unverifiedShifts: unverified.length,
        noncash: sum(shifts.map((s) => s.noncash)),
        manualPaid: sum(manual.map((m) => m.amount)),
        manualCount: manual.length,
      }
    })
  }, [data])

  const sim = useMemo(
    () => simulateLegacySettlement(data.payables, money, { includeNoncash, subtractManual }),
    [data.payables, money, includeNoncash, subtractManual],
  )
  const resultById = useMemo(() => new Map(sim.payables.map((p) => [p.id, p])), [sim.payables])

  const rows: BranchRow[] = useMemo(() => {
    const ids = new Set<number>([...money.map((m) => m.branchId), ...sim.branches.map((b) => b.branchId)])
    return [...ids].sort((a, b) => a - b).map((branchId) => {
      const m = money.find((x) => x.branchId === branchId)
      const s = sim.branches.find((x) => x.branchId === branchId)
      const own = data.payables.filter((p) => p.debtorBranchId === branchId)
      return {
        branchId,
        name: nameOf(branchId),
        openCount: own.length,
        openRemaining: sum(own.map((p) => p.remaining)),
        oldestDate: own[0]?.bornDate ?? null,
        verifiedCash: m?.verifiedCash ?? 0,
        verifiedShifts: m?.verifiedShifts ?? 0,
        unverifiedCash: m?.unverifiedCash ?? 0,
        unverifiedShifts: m?.unverifiedShifts ?? 0,
        noncash: m?.noncash ?? 0,
        manualPaid: m?.manualPaid ?? 0,
        manualCount: m?.manualCount ?? 0,
        available: s?.available ?? 0,
        usable: s?.usable ?? 0,
        receivedFromChain: s?.receivedFromChain ?? 0,
        paidOff: own.filter((p) => resultById.get(p.id)?.result === 'PAID').length,
        remainingAfter: sum(own.map((p) => resultById.get(p.id)?.remainingAfter ?? p.remaining)),
        freeAmount: s?.freeAmount ?? 0,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [money, sim, data.payables, resultById])

  const totals = {
    openCount: data.payables.length,
    openRemaining: sum(data.payables.map((p) => p.remaining)),
    paidOff: sim.payables.filter((p) => p.result === 'PAID').length,
    settled: sum(sim.payables.map((p) => p.settled)),
    remainingAfter: sum(sim.payables.map((p) => p.remainingAfter)),
  }

  function goFrom(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    setFromInput(date)
    router.push(`/purchase-orders/internal/payables/legacy?from=${date}`)
  }

  async function downloadExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Pilihan: 'Setoran dihitung sejak', Isi: data.fromDate },
      { Pilihan: 'Utang lama = lahir sebelum', Isi: data.cutoffDate },
      { Pilihan: 'Non-tunai', Isi: includeNoncash ? 'ikut' : 'tidak ikut' },
      { Pilihan: 'Pelunasan manual', Isi: subtractManual ? 'dikurangi' : 'tidak dikurangi' },
      { Pilihan: 'Catatan', Isi: 'Pratinjau saja — tidak ada data yang berubah' },
    ]), 'Pilihan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Cabang: r.name,
        'Utang lama (nota)': r.openCount,
        'Sisa utang lama': r.openRemaining,
        'Tagihan paling lama': r.oldestDate ?? '',
        'Kas terverifikasi': r.verifiedCash,
        'Shift terverifikasi': r.verifiedShifts,
        'Kas belum terverifikasi (info)': r.unverifiedCash,
        'Shift belum terverifikasi': r.unverifiedShifts,
        'Non-tunai (angka sistem)': r.noncash,
        'Pelunasan manual': r.manualPaid,
        'Uang tersedia': r.available,
        'Diterima dari rantai': r.receivedFromChain,
        'Nota jadi lunas': r.paidOff,
        'Sisa utang sesudahnya': r.remainingAfter,
        'Setoran bebas lama': r.freeAmount,
      })),
    ), 'Ringkasan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.payables.map((p) => {
      const r = resultById.get(p.id)
      return {
        IBT: p.ibtNumber ?? `#${p.transferId}`,
        'Cabang berutang': nameOf(p.debtorBranchId),
        Pemasok: nameOf(p.creditorBranchId),
        Tanggal: p.bornDate,
        Total: p.totalAmount,
        'Sudah dibayar': p.paidAmount,
        Sisa: p.remaining,
        'Dilunasi simulasi': r?.settled ?? 0,
        'Sisa sesudahnya': r?.remainingAfter ?? p.remaining,
        Hasil: RESULT_LABEL[r?.result ?? 'OPEN'].label,
      }
    })), 'Utang lama')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.shifts.map((s) => ({
      Cabang: nameOf(s.branchId),
      Shift: s.shiftNumber,
      'Tanggal tutup': s.closedDate,
      Status: s.verified ? 'Terverifikasi' : 'Belum terverifikasi',
      Kas: s.cash,
      'Non-tunai': s.noncash,
    }))), 'Shift')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.manualPayments.map((m) => ({
      Tanggal: m.paidDate,
      IBT: m.ibtNumber ?? '',
      'Cabang berutang': nameOf(m.debtorBranchId),
      Pemasok: nameOf(m.creditorBranchId),
      Jumlah: m.amount,
      Metode: m.methodName ?? '',
      Oleh: m.paidByName ?? '',
    }))), 'Pelunasan manual')
    XLSX.writeFile(wb, `pratinjau-utang-lama-${data.fromDate}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Setoran dihitung sejak</span>
          {quickDates.map((q) => (
            <button
              key={q.date}
              type="button"
              onClick={() => goFrom(q.date)}
              className={`rounded-md border px-3 py-1 ${data.fromDate === q.date ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted'}`}
            >
              {q.label}
            </button>
          ))}
          <input
            type="date"
            value={fromInput}
            max={data.cutoffDate}
            onChange={(e) => setFromInput(e.target.value)}
            onBlur={() => fromInput !== data.fromDate && goFrom(fromInput)}
            className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
          />
          <span className="text-muted-foreground">s.d. sebelum {data.cutoffDate}</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-foreground">
            <input type="checkbox" checked={includeNoncash} onChange={(e) => setIncludeNoncash(e.target.checked)} />
            Ikutkan non-tunai (angka sistem, belum terverifikasi)
          </label>
          <label className="flex items-center gap-2 text-foreground">
            <input type="checkbox" checked={subtractManual} onChange={(e) => setSubtractManual(e.target.checked)} />
            Kurangi pelunasan manual yang sudah dicatat
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowHelp((v) => !v)} className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted">
            {showHelp ? 'Tutup cara membaca' : 'Cara membaca'}
          </button>
          <button type="button" onClick={downloadExcel} className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted">
            Unduh Excel
          </button>
        </div>
        {showHelp && <HowToRead cutoffDate={data.cutoffDate} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-4 text-sm">
        <Stat label="Utang lama terbuka" value={rupiah(totals.openRemaining)} note={`${totals.openCount} nota`} />
        <Stat label="Kalau dijalankan: dilunasi" value={rupiah(totals.settled)} note={`${totals.paidOff} nota jadi lunas`} />
        <Stat label="Sisa utang lama sesudahnya" value={rupiah(totals.remainingAfter)} note="diputuskan satu per satu" />
        <Stat label="Setoran bebas lama" value={rupiah(sum(sim.branches.map((b) => b.freeAmount)))} note="hanya info" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cabang</th>
              <th className="px-3 py-2 text-right">Utang lama terbuka</th>
              <th className="px-3 py-2 text-right">Kas terverifikasi</th>
              <th className="px-3 py-2 text-right">Kas belum terverifikasi</th>
              <th className="px-3 py-2 text-right">Non-tunai</th>
              <th className="px-3 py-2 text-right">Pelunasan manual</th>
              <th className="px-3 py-2 text-right">Uang tersedia</th>
              <th className="px-3 py-2 text-right">Kalau dijalankan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.branchId}>
                <tr
                  onClick={() => setOpenBranch(openBranch === r.branchId ? null : r.branchId)}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{openBranch === r.branchId ? '▾' : '▸'} {r.name}</td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {rupiah(r.openRemaining)}
                    <span className="block text-xs text-muted-foreground">{r.openCount} nota{r.oldestDate ? ` · sejak ${r.oldestDate}` : ''}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {rupiah(r.verifiedCash)}
                    <span className="block text-xs text-muted-foreground">{r.verifiedShifts} shift</span>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {rupiah(r.unverifiedCash)}
                    <span className="block text-xs">{r.unverifiedShifts} shift · info</span>
                  </td>
                  <td className={`px-3 py-2 text-right ${includeNoncash ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{rupiah(r.noncash)}</td>
                  <td className={`px-3 py-2 text-right ${subtractManual ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                    {r.manualPaid > 0 ? `− ${rupiah(r.manualPaid)}` : rupiah(0)}
                    <span className="block text-xs text-muted-foreground no-underline">{r.manualCount} kali</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    {rupiah(r.usable)}
                    {r.available < 0 && (
                      <span className="block text-xs font-normal text-red-700 dark:text-red-400">manual melebihi setoran {rupiah(-r.available)}</span>
                    )}
                    {r.receivedFromChain > 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">+ {rupiah(r.receivedFromChain)} dari rantai</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {r.openCount > 0 ? `${r.paidOff} dari ${r.openCount} lunas` : '—'}
                    <span className="block text-xs text-muted-foreground">
                      sisa {rupiah(r.remainingAfter)} · bebas {rupiah(r.freeAmount)}
                    </span>
                  </td>
                </tr>
                {openBranch === r.branchId && (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={8} className="px-3 py-3">
                      <BranchDetail branchId={r.branchId} data={data} sim={sim} resultById={resultById} nameOf={nameOf} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Tidak ada utang lama terbuka maupun setoran di periode ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

function BranchDetail({ branchId, data, sim, resultById, nameOf }: {
  branchId: number
  data: LegacyPreviewData
  sim: ReturnType<typeof simulateLegacySettlement>
  resultById: Map<number, ReturnType<typeof simulateLegacySettlement>['payables'][number]>
  nameOf: (id: number) => string
}) {
  const payables = data.payables.filter((p) => p.debtorBranchId === branchId)
  const shifts = data.shifts.filter((s) => s.branchId === branchId)
  const manual = data.manualPayments.filter((m) => m.debtorBranchId === branchId)
  const ibtOf = new Map(data.payables.map((p) => [p.id, p.ibtNumber ?? `#${p.transferId}`]))
  const chain = sim.steps.filter((s) => s.originBranchId === branchId)

  return (
    <div className="grid gap-4 lg:grid-cols-2 text-xs">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Utang lama cabang ini</h3>
        {payables.length === 0 ? <p className="text-muted-foreground">Tidak ada.</p> : (
          <table className="w-full">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1">IBT</th><th>Pemasok</th><th>Tanggal</th><th className="text-right">Sisa</th><th className="text-right">Hasil</th></tr>
            </thead>
            <tbody>
              {payables.map((p) => {
                const r = resultById.get(p.id)
                const res = RESULT_LABEL[r?.result ?? 'OPEN']
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-1">
                      <Link href={`/purchase-orders/internal/${p.transferId}`} className="text-primary hover:underline">{p.ibtNumber ?? `#${p.transferId}`}</Link>
                    </td>
                    <td className="text-foreground">{nameOf(p.creditorBranchId)}</td>
                    <td className="text-foreground">{p.bornDate}</td>
                    <td className="text-right text-foreground">{rupiah(p.remaining)}</td>
                    <td className={`text-right ${res.cls}`}>
                      {res.label}{r && r.result === 'PARTIAL' ? ` (sisa ${rupiah(r.remainingAfter)})` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Ke mana uang setoran cabang ini (simulasi)</h3>
        {chain.length === 0 ? <p className="text-muted-foreground">Tidak ada uang tersedia.</p> : (
          <ul className="space-y-0.5">
            {chain.map((s, i) => (
              <li key={i} className="text-foreground" style={{ paddingLeft: `${(s.level - 1) * 16}px` }}>
                {s.level > 1 ? '↳ ' : ''}
                {s.payableId != null
                  ? <>{nameOf(s.payerBranchId)} → {ibtOf.get(s.payableId) ?? `#${s.payableId}`} <b>{rupiah(s.amount)}</b></>
                  : <>Setoran bebas {nameOf(s.payerBranchId)} <b>{rupiah(s.amount)}</b></>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Shift yang dihitung</h3>
        {shifts.length === 0 ? <p className="text-muted-foreground">Tidak ada shift di periode ini.</p> : (
          <table className="w-full">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1">Tanggal tutup</th><th>Shift</th><th>Status</th><th className="text-right">Kas</th><th className="text-right">Non-tunai</th></tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1 text-foreground">{s.closedDate}</td>
                  <td className="text-foreground">#{s.shiftNumber}</td>
                  <td className={s.verified ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
                    {s.verified ? 'Terverifikasi' : 'Belum (info)'}
                  </td>
                  <td className="text-right text-foreground">{rupiah(s.cash)}</td>
                  <td className="text-right text-foreground">{rupiah(s.noncash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Pelunasan manual yang sudah dicatat</h3>
        {manual.length === 0 ? <p className="text-muted-foreground">Tidak ada.</p> : (
          <table className="w-full">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1">Tanggal</th><th>IBT</th><th>Pemasok</th><th>Metode / oleh</th><th className="text-right">Jumlah</th></tr>
            </thead>
            <tbody>
              {manual.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-1 text-foreground">{m.paidDate}</td>
                  <td className="text-foreground">{m.ibtNumber ?? '—'}</td>
                  <td className="text-foreground">{nameOf(m.creditorBranchId)}</td>
                  <td className="text-muted-foreground">{[m.methodName, m.paidByName].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="text-right text-foreground">{rupiah(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function HowToRead({ cutoffDate }: { cutoffDate: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5 text-foreground">
      <p><b>Utang lama</b> = utang antar cabang (dari PO Internal) yang lahir sebelum {cutoffDate} dan belum lunas. Utang sejak tanggal itu sudah dilunasi otomatis oleh Setoran, jadi tidak ikut di sini.</p>
      <p><b>Kas terverifikasi</b> = jumlah uang tunai yang diketik Finance saat memverifikasi setoran shift di Riwayat Shift (cara lama), untuk shift yang ditutup sejak tanggal pilihan sampai sebelum {cutoffDate}.</p>
      <p><b>Kas belum terverifikasi</b> = angka hitungan kasir/sistem dari shift yang belum pernah diverifikasi. Hanya keterangan — tidak dipakai melunasi, karena belum ada yang memastikan uangnya diterima.</p>
      <p><b>Non-tunai</b> = QRIS, debit, dan kartu kredit menurut sistem. Belum pernah diverifikasi; hanya ikut bila dicentang.</p>
      <p><b>Pelunasan manual</b> = bayar utang internal yang diketik orang di menu Utang Internal sejak tanggal pilihan, atas utang lama (termasuk yang sekarang sudah lunas). Dianggap dibayar dari uang setoran yang sama, jadi dikurangi supaya uang tidak terhitung dua kali.</p>
      <p><b>Uang tersedia</b> = kas terverifikasi (+ non-tunai bila dicentang) − pelunasan manual (bila dicentang). Bila minus, tampil 0 dengan tanda merah.</p>
      <p><b>Kalau dijalankan</b> = uang tersedia melunasi utang lama cabang itu dari yang paling lama, siapa pun pemasoknya. Uang yang diterima pemasok (mis. Toko Pusat) diteruskan melunasi utang lama pemasok itu (mis. ke Gudang) — sama dengan pelunasan otomatis. Sisa uang = <b>setoran bebas lama</b> (hanya info).</p>
      <p>Halaman ini <b>tidak mengubah apa pun</b>. Klik nama cabang untuk melihat rincian nota, shift, pelunasan manual, dan ke mana uangnya mengalir.</p>
    </div>
  )
}
