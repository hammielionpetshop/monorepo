'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { NewBadge } from '@/components/ui/new-badge'
import type { BonusGroup, DeliveryHistoryRow, GroomingHistoryRow, GroomingSummary } from '@/lib/services/grooming-report-service'
import { formatDateTime, formatRp, STATUS_LABEL, type BranchOption, type GroomerOption, type ReportFilters } from './types'

type Tab = 'bonus' | 'riwayat' | 'delivery'

interface Props {
  filters: ReportFilters
  rows: GroomingHistoryRow[]
  deliveries: DeliveryHistoryRow[]
  summary: GroomingSummary
  branches: BranchOption[]
  groomers: GroomerOption[]
  canChangeGroomer: boolean
}

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
const tdClass = 'px-3 py-2 align-top'
const REASON_MIN = 5

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'DIBATALKAN'
      ? 'bg-destructive/10 text-destructive'
      : status === 'DIAMBIL' || status === 'SELESAI'
        ? 'bg-green-500/10 text-green-700'
        : 'bg-amber-500/10 text-amber-800'
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>{STATUS_LABEL[status] ?? status}</span>
}

function PaidBadge({ isPaid }: { isPaid: boolean }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${isPaid ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
      {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
    </span>
  )
}

function BonusTable({ title, firstColumn, countLabel, groups }: { title: string; firstColumn: string; countLabel: string; groups: BonusGroup[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h2>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className={thClass}>{firstColumn}</th>
                <th className={`${thClass} text-right`}>{countLabel}</th>
                <th className={`${thClass} text-right`}>Nilai sesudah diskon</th>
                <th className={`${thClass} text-right`}>Bonus</th>
                <th className={`${thClass} text-right`}>Di antaranya belum lunas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => (
                <tr key={g.key}>
                  <td className={`${tdClass} font-medium`}>{g.label}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{g.count}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatRp(g.netTotal)}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums`}>{formatRp(g.bonus)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-muted-foreground`}>
                    {g.unpaidCount > 0 ? `${g.unpaidCount} · ${formatRp(g.unpaidBonus)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function GroomingReportClient({ filters, rows, deliveries, summary, branches, groomers, canChangeGroomer }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('bonus')
  const [target, setTarget] = useState<GroomingHistoryRow | null>(null)
  const [newGroomerId, setNewGroomerId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openChanges, setOpenChanges] = useState<number | null>(null)

  const activeGroomers = groomers.filter((g) => g.isActive && g.isGroomer)
  const filteredToOneGroomer = Boolean(filters.groomerId || filters.payment || filters.q)

  function openChange(row: GroomingHistoryRow) {
    setTarget(row)
    setNewGroomerId('')
    setReason('')
    setFormError(null)
  }

  async function submitChange() {
    if (!target) return
    if (!newGroomerId) return setFormError('Pilih groomer penggantinya')
    if (reason.trim().length < REASON_MIN) return setFormError(`Alasan wajib diisi (minimal ${REASON_MIN} huruf)`)
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/bo/grooming/orders/${target.id}/change-groomer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groomerId: Number(newGroomerId), reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError((data as { error?: string }).error ?? `Gagal mengganti groomer (${res.status})`)
        return
      }
      toast.success('Groomer diganti. Bonus mengikuti groomer yang baru.')
      setTarget(null)
      router.refresh()
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'bonus', label: 'Laporan Jasa & Bonus' },
    { id: 'riwayat', label: `Riwayat Grooming (${rows.length})` },
    { id: 'delivery', label: `Delivery & Antar Barang (${deliveries.length})` },
  ]

  return (
    <div className="space-y-4">
      {target && (
        <RequiredChoiceDialog
          title={`Ganti groomer — ${target.petName} (${target.ticketNumber})`}
          tone="warning"
          actions={[
            { label: 'Batal', variant: 'secondary', disabled: saving, onClick: () => setTarget(null) },
            { label: saving ? 'Menyimpan…' : 'Simpan pergantian', variant: 'primary', disabled: saving, onClick: () => { void submitChange() } },
          ]}
        >
          <p>
            Groomer sekarang: <b>{target.groomerName}</b>. Bonus {formatRp(target.bonus)} akan pindah ke groomer yang baru.
            Pergantian ini tercatat (siapa, kapan, alasannya) dan tidak bisa dihapus.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Groomer yang benar *</label>
            <select className={inputClass} value={newGroomerId} onChange={(e) => setNewGroomerId(e.target.value)} disabled={saving}>
              <option value="">-- Pilih groomer --</option>
              {activeGroomers.filter((g) => g.id !== target.groomerId).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Alasan *</label>
            <textarea
              className={inputClass}
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
              placeholder="mis. kasir salah pilih, yang mengerjakan sebenarnya Asep"
            />
          </div>
          {formError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
        </RequiredChoiceDialog>
      )}

      {/* ── Saringan ── */}
      <form method="get" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Dari tanggal</label>
          <input type="date" name="startDate" defaultValue={filters.startDate} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Sampai tanggal</label>
          <input type="date" name="endDate" defaultValue={filters.endDate} className={inputClass} />
        </div>
        {branches.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cabang</label>
            <select name="branchId" defaultValue={filters.branchId} className={inputClass}>
              <option value="">Semua cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Groomer</label>
          <select name="groomerId" defaultValue={filters.groomerId} className={inputClass}>
            <option value="">Semua groomer</option>
            {groomers.filter((g) => g.isGroomer).map((g) => (
              <option key={g.id} value={g.id}>{g.name}{g.isActive ? '' : ' (nonaktif)'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status bayar</label>
          <select name="payment" defaultValue={filters.payment} className={inputClass}>
            <option value="">Semua</option>
            <option value="LUNAS">Lunas</option>
            <option value="BELUM">Belum lunas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cari</label>
          <input name="q" defaultValue={filters.q} placeholder="kucing / pemilik / HP / nota" className={inputClass} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Tampilkan
          </button>
          <a href="/reports/grooming" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            Bulan ini (atur ulang)
          </a>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-1 rounded-lg border border-border bg-card p-1 sm:grid-cols-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Laporan bonus ── */}
      {tab === 'bonus' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Grooming dihitung</p>
              <p className="text-xl font-bold tabular-nums">{summary.grooming.count} ekor</p>
              <p className="text-xs text-muted-foreground">
                {summary.grooming.cancelledCount} dibatalkan (tidak dihitung) · {summary.grooming.unpaidCount} belum lunas
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Pendapatan jasa (sesudah diskon)</p>
              <p className="text-xl font-bold tabular-nums">{formatRp(summary.grooming.netTotal)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total bonus groomer (10%)</p>
              <p className="text-xl font-bold tabular-nums">{formatRp(summary.grooming.bonus)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total bonus pengantar (50% ongkir)</p>
              <p className="text-xl font-bold tabular-nums">{formatRp(summary.delivery.bonus)}</p>
              <p className="text-xs text-muted-foreground">
                {summary.delivery.count} antaran ({summary.delivery.paidCount} berbayar · {summary.delivery.freeCount} gratis) · ongkir
                diterima {formatRp(summary.delivery.netTotal)}
              </p>
              {summary.delivery.freeCount > 0 && (
                <p className="text-xs font-medium text-amber-700">
                  Gratis ongkir: {summary.delivery.freeCount} antaran · {formatRp(summary.delivery.freeTotal)} ditanggung toko (tanpa bonus)
                </p>
              )}
            </div>
          </div>
          {filteredToOneGroomer && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900">
              Saringan groomer / status bayar / cari sedang aktif — angka grooming di bawah hanya untuk yang tersaring. Bonus
              pengantar tetap dihitung untuk seluruh periode dan cabang yang dipilih.
            </p>
          )}
          <BonusTable title="Bonus per groomer" firstColumn="Groomer" countLabel="Ekor" groups={summary.byGroomer} />
          <BonusTable title="Bonus pengantar (delivery grooming + antar barang)" firstColumn="Pengantar" countLabel="Antaran" groups={summary.byCourier} />
          <BonusTable title="Per jasa" firstColumn="Jasa" countLabel="Ekor" groups={summary.byService} />
          {summary.byBranch.length > 1 && <BonusTable title="Per cabang" firstColumn="Cabang" countLabel="Ekor" groups={summary.byBranch} />}
        </div>
      )}

      {/* ── Riwayat ── */}
      {tab === 'riwayat' && (
        <section className="rounded-lg border border-border bg-card">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada grooming pada saringan ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className={thClass}>Diterima</th>
                    <th className={thClass}>Karcis / cabang</th>
                    <th className={thClass}>Kucing &amp; pemilik</th>
                    <th className={thClass}>Jasa</th>
                    <th className={thClass}>Groomer {canChangeGroomer && <NewBadge feature="fitur/ganti-groomer" />}</th>
                    <th className={`${thClass} text-right`}>Harga</th>
                    <th className={`${thClass} text-right`}>Bonus</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === 'DIBATALKAN' ? 'bg-muted/30 text-muted-foreground' : undefined}>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(r.receivedAt)}</td>
                      <td className={tdClass}>
                        <span className="block font-medium">{r.ticketNumber}</span>
                        <span className="block text-xs text-muted-foreground">{r.branchName}</span>
                      </td>
                      <td className={tdClass}>
                        <span className="block font-medium">{r.petName} <span className="font-normal text-muted-foreground">({r.petSpecies})</span></span>
                        <span className="block text-xs text-muted-foreground">{r.ownerName}{r.ownerPhone ? ` · ${r.ownerPhone}` : ''}</span>
                        <span className="block text-xs text-muted-foreground">Kondisi: {r.condition}</span>
                      </td>
                      <td className={tdClass}>{r.serviceName}</td>
                      <td className={tdClass}>
                        <span className="block font-medium">{r.groomerName}</span>
                        {r.changes.length > 0 && (
                          <button type="button" onClick={() => setOpenChanges(openChanges === r.id ? null : r.id)} className="text-xs font-medium text-amber-700 hover:underline">
                            {r.changes.length}× diganti — {openChanges === r.id ? 'tutup' : 'lihat jejak'}
                          </button>
                        )}
                        {openChanges === r.id && (
                          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {r.changes.map((c, i) => (
                              <li key={i}>
                                {formatDateTime(c.at)} — {c.from} → {c.to} oleh {c.by ?? '-'}: “{c.reason}”
                              </li>
                            ))}
                          </ul>
                        )}
                        {canChangeGroomer && r.status !== 'DIBATALKAN' && (
                          <button type="button" onClick={() => openChange(r)} className="mt-1 block text-xs font-medium text-primary hover:underline">
                            Ganti groomer
                          </button>
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatRp(r.netPrice)}
                        {r.netPrice !== r.price && <span className="block text-xs text-muted-foreground line-through">{formatRp(r.price)}</span>}
                      </td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums`}>{r.status === 'DIBATALKAN' ? '-' : formatRp(r.bonus)}</td>
                      <td className={tdClass}>
                        <StatusBadge status={r.status} />
                        {r.status !== 'DIBATALKAN' && <span className="mt-1 block"><PaidBadge isPaid={r.isPaid} /></span>}
                        {r.status === 'DIBATALKAN' && r.cancelReason && <span className="mt-1 block text-xs">{r.cancelReason}</span>}
                        {r.pickedUpAt && <span className="mt-1 block text-xs text-muted-foreground">Diambil {formatDateTime(r.pickedUpAt)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Delivery ── */}
      {tab === 'delivery' && (
        <section className="rounded-lg border border-border bg-card">
          {deliveries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada delivery pada periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className={thClass}>Tanggal</th>
                    <th className={thClass}>Nota / cabang</th>
                    <th className={thClass}>Jenis / pelanggan</th>
                    <th className={thClass}>Pengantar</th>
                    <th className={`${thClass} text-right`}>Ongkir</th>
                    <th className={`${thClass} text-right`}>Bonus</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((d) => (
                    <tr key={d.id} className={d.status === 'DIBATALKAN' ? 'bg-muted/30 text-muted-foreground' : undefined}>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(d.createdAt)}</td>
                      <td className={tdClass}>
                        <span className="block font-medium">{d.trxNumber}</span>
                        <span className="block text-xs text-muted-foreground">{d.branchName}</span>
                      </td>
                      <td className={tdClass}>
                        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${d.kind === 'GROOMING' ? 'bg-sky-500/10 text-sky-700' : 'bg-muted text-foreground'}`}>
                          {d.kind === 'GROOMING' ? 'Grooming (antar-jemput)' : 'Antar barang'}
                          {d.kind === 'BARANG' && <NewBadge feature="fitur/antar-barang-pengantar" />}
                        </span>
                        {d.ownerName && <span className="block font-medium">{d.ownerName}</span>}
                        {d.address && <span className="block text-xs text-muted-foreground">{d.address}</span>}
                      </td>
                      <td className={`${tdClass} font-medium`}>{d.courierName}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {d.isFreeShipping ? (
                          <>
                            <span className="font-semibold text-amber-700">GRATIS</span>
                            <span className="block text-xs text-muted-foreground">{formatRp(d.freeValue)} ditanggung toko</span>
                          </>
                        ) : (
                          <>
                            {formatRp(d.netFee)}
                            {d.netFee !== d.fee && <span className="block text-xs text-muted-foreground line-through">{formatRp(d.fee)}</span>}
                          </>
                        )}
                      </td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums`}>{d.status === 'DIBATALKAN' ? '-' : formatRp(d.bonus)}</td>
                      <td className={tdClass}>
                        <StatusBadge status={d.status} />
                        {d.status !== 'DIBATALKAN' && <span className="mt-1 block"><PaidBadge isPaid={d.isPaid} /></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
